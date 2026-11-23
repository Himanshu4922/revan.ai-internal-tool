package db

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ravan-ai/agni-keymon/internal/models"
	"golang.org/x/crypto/bcrypt"
)

type Store struct {
	Pool *pgxpool.Pool
}

func Connect(ctx context.Context, url string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{Pool: pool}, nil
}

func (s *Store) Close() { s.Pool.Close() }

func (s *Store) Migrate(ctx context.Context) error {
	_, err := s.Pool.Exec(ctx, `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  role_label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_members_project_idx ON project_members(project_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL DEFAULT '',
  project_env TEXT NOT NULL CHECK (project_env IN ('prod','staging','testing','other')),
  encrypted_key TEXT NOT NULL,
  key_hint TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS credit_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  balance DOUBLE PRECISION,
  currency TEXT NOT NULL DEFAULT '',
  spend_period TEXT NOT NULL DEFAULT '',
  spend_amount DOUBLE PRECISION,
  raw_summary TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_snapshots_key_checked_idx ON credit_snapshots(api_key_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '',
  ok BOOLEAN NOT NULL DEFAULT false,
  error TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS alert_events_key_sent_idx ON alert_events(api_key_id, channel, sent_at DESC);
CREATE INDEX IF NOT EXISTS alert_events_project_sent_idx ON alert_events(project_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS api_keys_project_idx ON api_keys(project_id);
`)
	if err != nil {
		return err
	}
	return s.backfillProjects(ctx)
}

func (s *Store) backfillProjects(ctx context.Context) error {
	rows, err := s.Pool.Query(ctx, `
SELECT DISTINCT project_name FROM api_keys
WHERE project_id IS NULL AND project_name <> ''`)
	if err != nil {
		return err
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			return err
		}
		names = append(names, n)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, name := range names {
		p := &models.Project{Name: name, Description: "Auto-created from existing keys"}
		if err := s.CreateProject(ctx, p); err != nil {
			// unique race — fetch existing
			existing, err2 := s.GetProjectByName(ctx, name)
			if err2 != nil {
				return err
			}
			p = existing
		}
		_, err := s.Pool.Exec(ctx, `UPDATE api_keys SET project_id=$1 WHERE project_id IS NULL AND project_name=$2`, p.ID, name)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) EnsureUser(ctx context.Context, email, password string, role models.Role) error {
	if email == "" || password == "" {
		return nil
	}
	email = strings.ToLower(strings.TrimSpace(email))
	var exists bool
	err := s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)`, email).Scan(&exists)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = s.Pool.Exec(ctx,
		`INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3)`,
		email, string(hash), string(role))
	return err
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	var u models.User
	var role string
	err := s.Pool.QueryRow(ctx,
		`SELECT id, email, password_hash, role, created_at FROM users WHERE email=$1`, email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &role, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	u.Role = models.Role(role)
	return &u, nil
}

func (s *Store) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var u models.User
	var role string
	err := s.Pool.QueryRow(ctx,
		`SELECT id, email, password_hash, role, created_at FROM users WHERE id=$1`, id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &role, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	u.Role = models.Role(role)
	return &u, nil
}

// --- Projects ---

func (s *Store) ListProjects(ctx context.Context) ([]models.Project, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, name, description, created_at, updated_at FROM projects ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Project
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) GetProject(ctx context.Context, id uuid.UUID) (*models.Project, error) {
	var p models.Project
	err := s.Pool.QueryRow(ctx, `SELECT id, name, description, created_at, updated_at FROM projects WHERE id=$1`, id).
		Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Store) GetProjectByName(ctx context.Context, name string) (*models.Project, error) {
	var p models.Project
	err := s.Pool.QueryRow(ctx, `SELECT id, name, description, created_at, updated_at FROM projects WHERE name=$1`, name).
		Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Store) CreateProject(ctx context.Context, p *models.Project) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	now := time.Now().UTC()
	p.CreatedAt = now
	p.UpdatedAt = now
	_, err := s.Pool.Exec(ctx, `
INSERT INTO projects (id, name, description, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)`,
		p.ID, p.Name, p.Description, p.CreatedAt, p.UpdatedAt)
	return err
}

func (s *Store) UpdateProject(ctx context.Context, p *models.Project) error {
	p.UpdatedAt = time.Now().UTC()
	ct, err := s.Pool.Exec(ctx, `
UPDATE projects SET name=$2, description=$3, updated_at=$4 WHERE id=$1`,
		p.ID, p.Name, p.Description, p.UpdatedAt)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	_, _ = s.Pool.Exec(ctx, `UPDATE api_keys SET project_name=$2 WHERE project_id=$1`, p.ID, p.Name)
	return nil
}

func (s *Store) DeleteProject(ctx context.Context, id uuid.UUID) error {
	var n int
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM api_keys WHERE project_id=$1`, id).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return fmt.Errorf("project still has %d API key(s); move or delete them first", n)
	}
	ct, err := s.Pool.Exec(ctx, `DELETE FROM projects WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) ListMembers(ctx context.Context, projectID uuid.UUID) ([]models.ProjectMember, error) {
	rows, err := s.Pool.Query(ctx, `
SELECT id, project_id, name, email, phone, role_label, created_at
FROM project_members WHERE project_id=$1 ORDER BY name`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.ProjectMember, 0)
	for rows.Next() {
		var m models.ProjectMember
		if err := rows.Scan(&m.ID, &m.ProjectID, &m.Name, &m.Email, &m.Phone, &m.RoleLabel, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) AddMember(ctx context.Context, m *models.ProjectMember) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	m.CreatedAt = time.Now().UTC()
	_, err := s.Pool.Exec(ctx, `
INSERT INTO project_members (id, project_id, name, email, phone, role_label, created_at)
VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		m.ID, m.ProjectID, m.Name, m.Email, m.Phone, m.RoleLabel, m.CreatedAt)
	return err
}

func (s *Store) UpdateMember(ctx context.Context, m *models.ProjectMember) error {
	ct, err := s.Pool.Exec(ctx, `
UPDATE project_members SET name=$3, email=$4, phone=$5, role_label=$6
WHERE id=$1 AND project_id=$2`,
		m.ID, m.ProjectID, m.Name, m.Email, m.Phone, m.RoleLabel)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) DeleteMember(ctx context.Context, projectID, memberID uuid.UUID) error {
	ct, err := s.Pool.Exec(ctx, `DELETE FROM project_members WHERE id=$1 AND project_id=$2`, memberID, projectID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// --- Keys ---

func (s *Store) ListKeys(ctx context.Context) ([]models.APIKey, error) {
	return s.listKeys(ctx, nil)
}

func (s *Store) ListKeysByProject(ctx context.Context, projectID uuid.UUID) ([]models.APIKey, error) {
	return s.listKeys(ctx, &projectID)
}

func (s *Store) listKeys(ctx context.Context, projectID *uuid.UUID) ([]models.APIKey, error) {
	q := `
SELECT id, provider, label, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'), project_name, project_env,
       encrypted_key, key_hint, meta, notes, created_at, updated_at
FROM api_keys`
	args := []any{}
	if projectID != nil {
		q += ` WHERE project_id=$1`
		args = append(args, *projectID)
	}
	q += ` ORDER BY project_name, project_env, provider`
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.APIKey
	for rows.Next() {
		k, err := scanKey(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

func (s *Store) GetKey(ctx context.Context, id uuid.UUID) (*models.APIKey, error) {
	row := s.Pool.QueryRow(ctx, `
SELECT id, provider, label, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'), project_name, project_env,
       encrypted_key, key_hint, meta, notes, created_at, updated_at
FROM api_keys WHERE id=$1`, id)
	k, err := scanKey(row)
	if err != nil {
		return nil, err
	}
	return &k, nil
}

type scannable interface {
	Scan(dest ...any) error
}

func scanKey(row scannable) (models.APIKey, error) {
	var k models.APIKey
	var env string
	var meta []byte
	err := row.Scan(&k.ID, &k.Provider, &k.Label, &k.ProjectID, &k.ProjectName, &env, &k.EncryptedKey, &k.KeyHint, &meta, &k.Notes, &k.CreatedAt, &k.UpdatedAt)
	if err != nil {
		return k, err
	}
	k.ProjectEnv = models.ProjectEnv(env)
	if len(meta) == 0 {
		k.Meta = json.RawMessage(`{}`)
	} else {
		k.Meta = meta
	}
	return k, nil
}

func (s *Store) CreateKey(ctx context.Context, k *models.APIKey) error {
	if k.ID == uuid.Nil {
		k.ID = uuid.New()
	}
	now := time.Now().UTC()
	k.CreatedAt = now
	k.UpdatedAt = now
	if len(k.Meta) == 0 {
		k.Meta = json.RawMessage(`{}`)
	}
	if k.ProjectID != uuid.Nil {
		p, err := s.GetProject(ctx, k.ProjectID)
		if err != nil {
			return fmt.Errorf("invalid project_id: %w", err)
		}
		k.ProjectName = p.Name
	}
	_, err := s.Pool.Exec(ctx, `
INSERT INTO api_keys (id, provider, label, project_id, project_name, project_env, encrypted_key, key_hint, meta, notes, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		k.ID, k.Provider, k.Label, k.ProjectID, k.ProjectName, string(k.ProjectEnv), k.EncryptedKey, k.KeyHint, []byte(k.Meta), k.Notes, k.CreatedAt, k.UpdatedAt)
	return err
}

func (s *Store) UpdateKey(ctx context.Context, k *models.APIKey) error {
	k.UpdatedAt = time.Now().UTC()
	if len(k.Meta) == 0 {
		k.Meta = json.RawMessage(`{}`)
	}
	if k.ProjectID != uuid.Nil {
		p, err := s.GetProject(ctx, k.ProjectID)
		if err != nil {
			return fmt.Errorf("invalid project_id: %w", err)
		}
		k.ProjectName = p.Name
	}
	ct, err := s.Pool.Exec(ctx, `
UPDATE api_keys SET provider=$2, label=$3, project_id=$4, project_name=$5, project_env=$6,
  encrypted_key=$7, key_hint=$8, meta=$9, notes=$10, updated_at=$11
WHERE id=$1`,
		k.ID, k.Provider, k.Label, k.ProjectID, k.ProjectName, string(k.ProjectEnv), k.EncryptedKey, k.KeyHint, []byte(k.Meta), k.Notes, k.UpdatedAt)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) DeleteKey(ctx context.Context, id uuid.UUID) error {
	ct, err := s.Pool.Exec(ctx, `DELETE FROM api_keys WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) InsertSnapshot(ctx context.Context, snap *models.CreditSnapshot) error {
	if snap.ID == uuid.Nil {
		snap.ID = uuid.New()
	}
	if snap.CheckedAt.IsZero() {
		snap.CheckedAt = time.Now().UTC()
	}
	_, err := s.Pool.Exec(ctx, `
INSERT INTO credit_snapshots (id, api_key_id, status, balance, currency, spend_period, spend_amount, raw_summary, error, checked_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		snap.ID, snap.APIKeyID, string(snap.Status), snap.Balance, snap.Currency, snap.SpendPeriod, snap.SpendAmount, snap.RawSummary, snap.Error, snap.CheckedAt)
	return err
}

func (s *Store) LatestSnapshot(ctx context.Context, keyID uuid.UUID) (*models.CreditSnapshot, error) {
	var snap models.CreditSnapshot
	var status string
	err := s.Pool.QueryRow(ctx, `
SELECT id, api_key_id, status, balance, currency, spend_period, spend_amount, raw_summary, error, checked_at
FROM credit_snapshots WHERE api_key_id=$1 ORDER BY checked_at DESC LIMIT 1`, keyID,
	).Scan(&snap.ID, &snap.APIKeyID, &status, &snap.Balance, &snap.Currency, &snap.SpendPeriod, &snap.SpendAmount, &snap.RawSummary, &snap.Error, &snap.CheckedAt)
	if err != nil {
		return nil, err
	}
	snap.Status = models.CreditStatus(status)
	return &snap, nil
}

func (s *Store) Dashboard(ctx context.Context, projectID *uuid.UUID) ([]models.ProjectDashboard, error) {
	var projects []models.Project
	var err error
	if projectID != nil {
		p, err := s.GetProject(ctx, *projectID)
		if err != nil {
			return nil, err
		}
		projects = []models.Project{*p}
	} else {
		projects, err = s.ListProjects(ctx)
		if err != nil {
			return nil, err
		}
	}

	out := make([]models.ProjectDashboard, 0, len(projects))
	for _, p := range projects {
		members, err := s.ListMembers(ctx, p.ID)
		if err != nil {
			return nil, err
		}
		keys, err := s.ListKeysByProject(ctx, p.ID)
		if err != nil {
			return nil, err
		}
		pd := models.ProjectDashboard{Project: p, Members: members, Items: []models.DashboardRow{}}
		for _, k := range keys {
			row := models.DashboardRow{Key: k}
			row.Key.EncryptedKey = ""
			snap, err := s.LatestSnapshot(ctx, k.ID)
			if err == nil {
				row.Snapshot = snap
				pd.Summary.Total++
				switch snap.Status {
				case models.StatusOK:
					pd.Summary.OK++
				case models.StatusLow:
					pd.Summary.Low++
				case models.StatusExhausted:
					pd.Summary.Exhausted++
				case models.StatusError:
					pd.Summary.Error++
				default:
					pd.Summary.Unknown++
				}
			} else if err != pgx.ErrNoRows {
				return nil, err
			} else {
				pd.Summary.Total++
				pd.Summary.Unknown++
			}
			pd.Items = append(pd.Items, row)
		}
		out = append(out, pd)
	}
	return out, nil
}

func (s *Store) InsertAlert(ctx context.Context, ev *models.AlertEvent) error {
	if ev.ID == uuid.Nil {
		ev.ID = uuid.New()
	}
	if ev.SentAt.IsZero() {
		ev.SentAt = time.Now().UTC()
	}
	_, err := s.Pool.Exec(ctx, `
INSERT INTO alert_events (id, api_key_id, project_id, channel, payload, ok, error, sent_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		ev.ID, ev.APIKeyID, ev.ProjectID, ev.Channel, ev.Payload, ev.OK, ev.Error, ev.SentAt)
	return err
}

func (s *Store) LastAlertOK(ctx context.Context, keyID uuid.UUID, channel string) (*time.Time, error) {
	var t time.Time
	err := s.Pool.QueryRow(ctx, `
SELECT sent_at FROM alert_events
WHERE api_key_id=$1 AND channel=$2 AND ok=true
ORDER BY sent_at DESC LIMIT 1`, keyID, channel).Scan(&t)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *Store) Ping(ctx context.Context) error {
	return s.Pool.Ping(ctx)
}

func ErrNoRows(err error) bool {
	return err == pgx.ErrNoRows
}

func FormatErr(err error) string {
	if err == nil {
		return ""
	}
	return fmt.Sprintf("%v", err)
}
