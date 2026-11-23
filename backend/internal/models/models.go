package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleAdmin  Role = "admin"
	RoleViewer Role = "viewer"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         Role      `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

type ProjectEnv string

const (
	EnvProd    ProjectEnv = "prod"
	EnvStaging ProjectEnv = "staging"
	EnvTesting ProjectEnv = "testing"
	EnvOther   ProjectEnv = "other"
)

type Project struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ProjectMember struct {
	ID        uuid.UUID `json:"id"`
	ProjectID uuid.UUID `json:"project_id"`
	Name      string    `json:"name"`
	Email     string    `json:"email,omitempty"`
	Phone     string    `json:"phone,omitempty"`
	RoleLabel string    `json:"role_label,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type APIKey struct {
	ID           uuid.UUID       `json:"id"`
	Provider     string          `json:"provider"`
	Label        string          `json:"label"`
	ProjectID    uuid.UUID       `json:"project_id"`
	ProjectName  string          `json:"project_name"`
	ProjectEnv   ProjectEnv      `json:"project_env"`
	EncryptedKey string          `json:"-"`
	KeyHint      string          `json:"key_hint"`
	Meta         json.RawMessage `json:"meta,omitempty"`
	Notes        string          `json:"notes,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type CreditStatus string

const (
	StatusOK        CreditStatus = "ok"
	StatusLow       CreditStatus = "low"
	StatusExhausted CreditStatus = "exhausted"
	StatusError     CreditStatus = "error"
	StatusUnknown   CreditStatus = "unknown"
)

type CreditSnapshot struct {
	ID          uuid.UUID    `json:"id"`
	APIKeyID    uuid.UUID    `json:"api_key_id"`
	Status      CreditStatus `json:"status"`
	Balance     *float64     `json:"balance,omitempty"`
	Currency    string       `json:"currency,omitempty"`
	SpendPeriod string       `json:"spend_period,omitempty"`
	SpendAmount *float64     `json:"spend_amount,omitempty"`
	RawSummary  string       `json:"raw_summary,omitempty"`
	Error       string       `json:"error,omitempty"`
	CheckedAt   time.Time    `json:"checked_at"`
}

type AlertEvent struct {
	ID        uuid.UUID  `json:"id"`
	APIKeyID  uuid.UUID  `json:"api_key_id"`
	ProjectID *uuid.UUID `json:"project_id,omitempty"`
	Channel   string     `json:"channel"`
	Payload   string     `json:"payload"`
	OK        bool       `json:"ok"`
	Error     string     `json:"error,omitempty"`
	SentAt    time.Time  `json:"sent_at"`
}

type DashboardRow struct {
	Key      APIKey          `json:"key"`
	Snapshot *CreditSnapshot `json:"snapshot,omitempty"`
}

type ProjectStatusSummary struct {
	OK        int `json:"ok"`
	Low       int `json:"low"`
	Exhausted int `json:"exhausted"`
	Error     int `json:"error"`
	Unknown   int `json:"unknown"`
	Total     int `json:"total"`
}

type ProjectDashboard struct {
	Project Project              `json:"project"`
	Members []ProjectMember      `json:"members"`
	Items   []DashboardRow       `json:"items"`
	Summary ProjectStatusSummary `json:"summary"`
}
