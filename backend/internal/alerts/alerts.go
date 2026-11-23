package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/ravan-ai/agni-keymon/internal/config"
	"github.com/ravan-ai/agni-keymon/internal/db"
	"github.com/ravan-ai/agni-keymon/internal/models"
)

type Service struct {
	cfg    config.Config
	store  *db.Store
	client *http.Client
}

func New(cfg config.Config, store *db.Store) *Service {
	return &Service{
		cfg:    cfg,
		store:  store,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *Service) MaybeAlert(ctx context.Context, key models.APIKey, snap models.CreditSnapshot) {
	if snap.Status != models.StatusLow && snap.Status != models.StatusExhausted {
		return
	}
	var members []models.ProjectMember
	if key.ProjectID.String() != "00000000-0000-0000-0000-000000000000" {
		members, _ = s.store.ListMembers(ctx, key.ProjectID)
	}
	msg := formatMessage(key, snap, members)
	s.sendWhatsApp(ctx, key, msg)
	s.sendCall(ctx, key, msg)
}

func formatMessage(key models.APIKey, snap models.CreditSnapshot, members []models.ProjectMember) string {
	bal := "n/a"
	if snap.Balance != nil {
		bal = fmt.Sprintf("%.4f %s", *snap.Balance, snap.Currency)
	}
	team := "none listed"
	if len(members) > 0 {
		parts := make([]string, 0, len(members))
		for _, m := range members {
			bit := m.Name
			if m.RoleLabel != "" {
				bit += " (" + m.RoleLabel + ")"
			}
			if m.Email != "" {
				bit += " <" + m.Email + ">"
			}
			parts = append(parts, bit)
		}
		team = strings.Join(parts, ", ")
	}
	return fmt.Sprintf(
		"[Agni Key Monitor] %s key LOW/EXHAUSTED\nProject: %s\nEnv: %s\nProvider: %s\nLabel: %s\nStatus: %s\nBalance: %s\nSummary: %s\nTeam: %s\nChecked: %s",
		string(snap.Status),
		key.ProjectName,
		key.ProjectEnv,
		key.Provider,
		key.Label,
		snap.Status,
		bal,
		snap.RawSummary,
		team,
		snap.CheckedAt.Format(time.RFC3339),
	)
}

func (s *Service) cooledDown(ctx context.Context, key models.APIKey, channel string) bool {
	t, err := s.store.LastAlertOK(ctx, key.ID, channel)
	if err != nil || t == nil {
		return false
	}
	return time.Since(*t) < s.cfg.AlertCooldown
}

func (s *Service) sendWhatsApp(ctx context.Context, key models.APIKey, msg string) {
	if s.cfg.WhatsAppXBaseURL == "" || s.cfg.WhatsAppXAPIKey == "" || s.cfg.WhatsAppXTo == "" {
		return
	}
	if s.cooledDown(ctx, key, "whatsapp") {
		return
	}
	payload := whatsAppXSendPayload(s.cfg.WhatsAppXTo, msg)
	body, _ := json.Marshal(payload)
	url := s.cfg.WhatsAppXBaseURL + "/api/conversations"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		_ = s.store.InsertAlert(ctx, alertEv(key, "whatsapp", msg, false, err.Error()))
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.cfg.WhatsAppXAPIKey)
	resp, err := s.client.Do(req)
	if err != nil {
		_ = s.store.InsertAlert(ctx, alertEv(key, "whatsapp", msg, false, err.Error()))
		return
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	ok := resp.StatusCode >= 200 && resp.StatusCode < 300
	ev := alertEv(key, "whatsapp", msg, ok, "")
	if !ok {
		ev.Error = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(rb))
	}
	_ = s.store.InsertAlert(ctx, ev)
}

// whatsAppXSendPayload mirrors local-periskope / WhatsAppX POST /api/conversations.
// Groups and linked-id chats use chat_jid; everything else is a phone number.
func whatsAppXSendPayload(to, body string) map[string]any {
	to = strings.TrimSpace(to)
	if strings.HasSuffix(to, "@g.us") || strings.HasSuffix(to, "@lid") {
		return map[string]any{"chat_jid": to, "body": body}
	}
	phone := to
	if i := strings.IndexByte(phone, '@'); i >= 0 {
		phone = phone[:i]
	}
	if i := strings.IndexByte(phone, ':'); i >= 0 {
		phone = phone[:i]
	}
	return map[string]any{"phone": phone, "body": body}
}

func (s *Service) sendCall(ctx context.Context, key models.APIKey, msg string) {
	if s.cfg.CallingAPIBase == "" || s.cfg.AlertCallAgentID == "" || s.cfg.AlertCallFrom == "" || s.cfg.AlertCallTo == "" {
		return
	}
	if s.cooledDown(ctx, key, "calling") {
		return
	}
	payload := map[string]any{
		"type":              "outbound_call",
		"from_phone_number": s.cfg.AlertCallFrom,
		"to_phone_number":   s.cfg.AlertCallTo,
		"agent_id":          s.cfg.AlertCallAgentID,
		"prompt_dynamic_variables": map[string]string{
			"alert_message": msg,
			"provider":      key.Provider,
			"project":       key.ProjectName,
			"project_env":   string(key.ProjectEnv),
			"status":        "low_credit",
		},
	}
	body, _ := json.Marshal(payload)
	url := s.cfg.CallingAPIBase + "/api/v1/calling/create-call"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		_ = s.store.InsertAlert(ctx, alertEv(key, "calling", msg, false, err.Error()))
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if s.cfg.CallingInternalKey != "" {
		req.Header.Set("X-Internal-Api-Key", s.cfg.CallingInternalKey)
		req.Header.Set("Authorization", "Bearer "+s.cfg.CallingInternalKey)
	}
	if s.cfg.AlertCallOrgID != "" {
		req.Header.Set("X-Organization-Id", s.cfg.AlertCallOrgID)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		_ = s.store.InsertAlert(ctx, alertEv(key, "calling", msg, false, err.Error()))
		return
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	ok := resp.StatusCode >= 200 && resp.StatusCode < 300
	ev := alertEv(key, "calling", string(body), ok, "")
	if !ok {
		ev.Error = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(rb))
	}
	_ = s.store.InsertAlert(ctx, ev)
}

func alertEv(key models.APIKey, channel, payload string, ok bool, errMsg string) *models.AlertEvent {
	ev := &models.AlertEvent{
		APIKeyID: key.ID,
		Channel:  channel,
		Payload:  payload,
		OK:       ok,
		Error:    errMsg,
	}
	if key.ProjectID.String() != "00000000-0000-0000-0000-000000000000" {
		pid := key.ProjectID
		ev.ProjectID = &pid
	}
	return ev
}
