package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppEnv           string
	ServerPort       string
	DatabaseURL      string
	JWTSecret        string
	EncryptionKeyHex string
	CookieSecure     bool
	CookieSameSite   string
	CORSOrigins      []string

	AdminEmail    string
	AdminPassword string
	ViewerEmail   string
	ViewerPassword string

	CheckInterval     time.Duration
	AlertLowThreshold float64
	AlertCooldown     time.Duration

	// Local Periskope / WhatsAppX (self-hosted). Never api.periskope.app.
	WhatsAppXBaseURL string
	WhatsAppXAPIKey  string
	WhatsAppXTo      string // phone digits, or chat jid (...@g.us / ...@lid)

	CallingAPIBase     string
	CallingInternalKey string
	AlertCallAgentID   string
	AlertCallFrom      string
	AlertCallTo        string
	AlertCallOrgID     string
}

func Load() Config {
	return Config{
		AppEnv:           getenv("APP_ENV", "production"),
		ServerPort:       getenv("SERVER_PORT", "8080"),
		DatabaseURL:      getenv("DATABASE_URL", ""),
		JWTSecret:        getenv("JWT_SECRET", ""),
		EncryptionKeyHex: getenv("APP_ENCRYPTION_KEY", ""),
		CookieSecure:     getenv("COOKIE_SECURE", "true") == "true",
		CookieSameSite:   getenv("COOKIE_SAMESITE", "lax"),
		CORSOrigins:      splitCSV(getenv("CORS_ORIGINS", "http://localhost:3095")),

		AdminEmail:     getenv("ADMIN_EMAIL", ""),
		AdminPassword:  getenv("ADMIN_PASSWORD", ""),
		ViewerEmail:    getenv("VIEWER_EMAIL", ""),
		ViewerPassword: getenv("VIEWER_PASSWORD", ""),

		CheckInterval:     minutes("CHECK_INTERVAL_MINUTES", 20),
		AlertLowThreshold: floatEnv("ALERT_LOW_THRESHOLD", 5),
		AlertCooldown:     hours("ALERT_COOLDOWN_HOURS", 6),

		WhatsAppXBaseURL: strings.TrimRight(getenv("WHATSAPPX_BASE_URL", "http://host.docker.internal:8080"), "/"),
		WhatsAppXAPIKey:  getenv("WHATSAPPX_API_KEY", ""),
		WhatsAppXTo:      strings.TrimSpace(getenv("WHATSAPPX_TO", "")),

		CallingAPIBase:     strings.TrimRight(getenv("CALLING_API_BASE", "https://api.ravan.ai"), "/"),
		CallingInternalKey: getenv("CALLING_INTERNAL_KEY", ""),
		AlertCallAgentID:   getenv("ALERT_CALL_AGENT_ID", ""),
		AlertCallFrom:      getenv("ALERT_CALL_FROM", ""),
		AlertCallTo:        getenv("ALERT_CALL_TO", ""),
		AlertCallOrgID:     getenv("ALERT_CALL_ORG_ID", ""),
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func minutes(k string, def int) time.Duration {
	n := def
	if v := os.Getenv(k); v != "" {
		if i, err := strconv.Atoi(v); err == nil && i > 0 {
			n = i
		}
	}
	return time.Duration(n) * time.Minute
}

func hours(k string, def int) time.Duration {
	n := def
	if v := os.Getenv(k); v != "" {
		if i, err := strconv.Atoi(v); err == nil && i > 0 {
			n = i
		}
	}
	return time.Duration(n) * time.Hour
}

func floatEnv(k string, def float64) float64 {
	if v := os.Getenv(k); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return def
}
