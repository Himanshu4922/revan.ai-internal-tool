package checkers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/ravan-ai/agni-keymon/internal/models"
)

type Result struct {
	Status      models.CreditStatus
	Balance     *float64
	Currency    string
	SpendPeriod string
	SpendAmount *float64
	Summary     string
	Error       string
}

type Checker interface {
	Check(ctx context.Context, secret string, meta json.RawMessage) Result
}

func ForProvider(provider string) Checker {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "openai":
		return OpenAI{}
	case "anthropic":
		return Anthropic{}
	case "twilio":
		return Twilio{}
	case "plivo":
		return Plivo{}
	case "telnyx":
		return Telnyx{}
	case "stripe":
		return Stripe{}
	case "sendgrid":
		return SendGrid{}
	case "gemini", "google", "okf_gemini":
		return Gemini{}
	case "pinecone":
		return Pinecone{}
	case "livekit":
		return LiveKit{}
	case "soniox":
		return Soniox{}
	case "sarvam":
		return Sarvam{}
	default:
		return GenericHTTP{}
	}
}

func ApplyThreshold(r Result, low float64) Result {
	if r.Status == models.StatusError {
		return r
	}
	if r.Balance != nil {
		if *r.Balance <= 0 {
			r.Status = models.StatusExhausted
		} else if *r.Balance < low {
			r.Status = models.StatusLow
		} else if r.Status == models.StatusUnknown || r.Status == "" {
			r.Status = models.StatusOK
		}
	}
	return r
}

var httpClient = &http.Client{Timeout: 25 * time.Second}

func doJSON(ctx context.Context, method, url string, headers map[string]string, body io.Reader) (int, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return 0, nil, err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if body != nil && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	return resp.StatusCode, b, err
}

func fptr(v float64) *float64 { return &v }

func metaString(meta json.RawMessage, keys ...string) string {
	if len(meta) == 0 {
		return ""
	}
	var m map[string]any
	if err := json.Unmarshal(meta, &m); err != nil {
		return ""
	}
	for _, k := range keys {
		if v, ok := m[k]; ok {
			switch t := v.(type) {
			case string:
				if t != "" {
					return t
				}
			}
		}
	}
	return ""
}

// --- Providers ---

type OpenAI struct{}

func (OpenAI) Check(ctx context.Context, secret string, _ json.RawMessage) Result {
	code, body, err := doJSON(ctx, http.MethodGet, "https://api.openai.com/v1/models", map[string]string{
		"Authorization": "Bearer " + secret,
	}, nil)
	if err != nil {
		return Result{Status: models.StatusError, Error: err.Error()}
	}
	if code == 401 || code == 403 {
		return Result{Status: models.StatusError, Error: "invalid OpenAI key", Summary: string(body)}
	}
	if code >= 400 {
		return Result{Status: models.StatusError, Error: fmt.Sprintf("openai models HTTP %d", code), Summary: truncate(body)}
	}
	// Best-effort usage (may require org admin / billing scope)
	now := time.Now().UTC()
	start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	uURL := fmt.Sprintf("https://api.openai.com/v1/organization/costs?start_time=%d&limit=1", start.Unix())
	ucode, ubody, _ := doJSON(ctx, http.MethodGet, uURL, map[string]string{
		"Authorization": "Bearer " + secret,
	}, nil)
	r := Result{Status: models.StatusOK, Summary: "key valid", Currency: "USD"}
	if ucode == 200 {
		var parsed struct {
			Data []struct {
				Amount struct {
					Value    float64 `json:"value"`
					Currency string  `json:"currency"`
				} `json:"amount"`
			} `json:"data"`
		}
		if json.Unmarshal(ubody, &parsed) == nil && len(parsed.Data) > 0 {
			r.SpendAmount = fptr(parsed.Data[0].Amount.Value)
			r.SpendPeriod = "month_to_date"
			if parsed.Data[0].Amount.Currency != "" {
				r.Currency = parsed.Data[0].Amount.Currency
			}
			r.Summary = fmt.Sprintf("key valid; MTD cost %.4f %s", *r.SpendAmount, r.Currency)
		} else {
			r.Status = models.StatusUnknown
			r.Summary = "key valid; costs API unavailable or empty"
		}
	} else {
		r.Status = models.StatusUnknown
		r.Summary = "key valid; balance/spend not exposed for this key"
	}
	return r
}

type Anthropic struct{}

func (Anthropic) Check(ctx context.Context, secret string, _ json.RawMessage) Result {
	code, body, err := doJSON(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", map[string]string{
		"x-api-key":         secret,
		"anthropic-version": "2023-06-01",
		"Content-Type":      "application/json",
	}, strings.NewReader(`{"model":"claude-3-haiku-20240307","max_tokens":1,"messages":[{"role":"user","content":"ping"}]}`))
	if err != nil {
		return Result{Status: models.StatusError, Error: err.Error()}
	}
	if code == 401 || code == 403 {
		return Result{Status: models.StatusError, Error: "invalid Anthropic key", Summary: truncate(body)}
	}
	// 400 with credit errors often means exhausted
	if code == 400 && (strings.Contains(strings.ToLower(string(body)), "credit") || strings.Contains(strings.ToLower(string(body)), "billing")) {
		return Result{Status: models.StatusExhausted, Summary: truncate(body), Error: "billing/credit issue"}
	}
	if code >= 400 && code != 404 {
		// Some keys reject message but still authenticate via 401 only; treat 429 as ok-ish
		if code == 429 {
			return Result{Status: models.StatusOK, Summary: "key valid (rate limited)"}
		}
		return Result{Status: models.StatusUnknown, Summary: fmt.Sprintf("HTTP %d: %s", code, truncate(body))}
	}
	return Result{Status: models.StatusOK, Summary: "key valid; spend not exposed via API key"}
}

type Twilio struct{}

func (Twilio) Check(ctx context.Context, secret string, meta json.RawMessage) Result {
	sid := metaString(meta, "account_sid", "sid", "TWILIO_ACCOUNT_SID")
	if sid == "" {
		// secret may be "SID:TOKEN"
		if parts := strings.SplitN(secret, ":", 2); len(parts) == 2 {
			sid, secret = parts[0], parts[1]
		}
	}
	if sid == "" {
		return Result{Status: models.StatusError, Error: "twilio account_sid required in meta"}
	}
	auth := base64.StdEncoding.EncodeToString([]byte(sid + ":" + secret))
	code, body, err := doJSON(ctx, http.MethodGet, "https://api.twilio.com/2010-04-01/Accounts/"+sid+"/Balance.json", map[string]string{
		"Authorization": "Basic " + auth,
	}, nil)
	if err != nil {
		return Result{Status: models.StatusError, Error: err.Error()}
	}
	if code >= 400 {
		return Result{Status: models.StatusError, Error: fmt.Sprintf("twilio HTTP %d", code), Summary: truncate(body)}
	}
	var parsed struct {
		Balance  string `json:"balance"`
		Currency string `json:"currency"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return Result{Status: models.StatusError, Error: err.Error()}
	}
	bal, _ := strconv.ParseFloat(parsed.Balance, 64)
	return Result{
		Status:   models.StatusOK,
		Balance:  fptr(bal),
		Currency: parsed.Currency,
		Summary:  fmt.Sprintf("balance %s %s", parsed.Balance, parsed.Currency),
	}
}

type Plivo struct{}

func (Plivo) Check(ctx context.Context, secret string, meta json.RawMessage) Result {
	authID := metaString(meta, "auth_id", "account_sid", "PLIVO_ACCOUNT_SID")
	if authID == "" {
		if parts := strings.SplitN(secret, ":", 2); len(parts) == 2 {
			authID, secret = parts[0], parts[1]
		}
	}
	if authID == "" {
		return Result{Status: models.StatusError, Error: "plivo auth_id required in meta"}
	}
	auth := base64.StdEncoding.EncodeToString([]byte(authID + ":" + secret))
	code, body, err := doJSON(ctx, http.MethodGet, "https://api.plivo.com/v1/Account/"+authID+"/", map[string]string{
		"Authorization": "Basic " + auth,
	}, nil)
	if err != nil {
		return Result{Status: models.StatusError, Error: err.Error()}
	}
	if code >= 400 {
		return Result{Status: models.StatusError, Error: fmt.Sprintf("plivo HTTP %d", code), Summary: truncate(body)}
	}
	var parsed struct {
		CashCredits string  `json:"cash_credits"`
		AccountType string  `json:"account_type"`
	}
	_ = json.Unmarshal(body, &parsed)
	bal, _ := strconv.ParseFloat(parsed.CashCredits, 64)
	return Result{
		Status:   models.StatusOK,
		Balance:  fptr(bal),
		Currency: "USD",
		Summary:  fmt.Sprintf("cash_credits=%s type=%s", parsed.CashCredits, parsed.AccountType),
	}
}

type Telnyx struct{}

func (Telnyx) Check(ctx context.Context, secret string, _ json.RawMessage) Result {
	code, body, err := doJSON(ctx, http.MethodGet, "https://api.telnyx.com/v2/balance", map[string]string{
		"Authorization": "Bearer " + secret,
	}, nil)
	if err != nil {
		return Result{Status: models.StatusError, Error: err.Error()}
	}
	if code >= 400 {
		return Result{Status: models.StatusError, Error: fmt.Sprintf("telnyx HTTP %d", code), Summary: truncate(body)}
	}
	var parsed struct {
		Data struct {
			Balance           json.Number `json:"balance"`
			CreditLimit       json.Number `json:"credit_limit"`
			Currency          string      `json:"currency"`
			AvailableCredit   json.Number `json:"available_credit"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return Result{Status: models.StatusError, Error: err.Error(), Summary: truncate(body)}
	}
	bal, _ := parsed.Data.Balance.Float64()
	avail, _ := parsed.Data.AvailableCredit.Float64()
	use := bal
	if avail > 0 {
		use = avail
	}
	return Result{
		Status:   models.StatusOK,
		Balance:  fptr(use),
		Currency: parsed.Data.Currency,
		Summary:  fmt.Sprintf("balance=%.4f available=%.4f %s", bal, avail, parsed.Data.Currency),
	}
}

type Stripe struct{}

func (Stripe) Check(ctx context.Context, secret string, _ json.RawMessage) Result {
	code, body, err := doJSON(ctx, http.MethodGet, "https://api.stripe.com/v1/balance", map[string]string{
		"Authorization": "Bearer " + secret,
	}, nil)
	if err != nil {
		return Result{Status: models.StatusError, Error: err.Error()}
	}
	if code >= 400 {
		return Result{Status: models.StatusError, Error: fmt.Sprintf("stripe HTTP %d", code), Summary: truncate(body)}
	}
	var parsed struct {
		Available []struct {
			Amount   int64  `json:"amount"`
			Currency string `json:"currency"`
		} `json:"available"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return Result{Status: models.StatusError, Error: err.Error()}
	}
	var total float64
	cur := "usd"
	for _, a := range parsed.Available {
		total += float64(a.Amount) / 100.0
		cur = a.Currency
	}
	return Result{
		Status:   models.StatusOK,
		Balance:  fptr(total),
		Currency: strings.ToUpper(cur),
		Summary:  fmt.Sprintf("available %.2f %s", total, strings.ToUpper(cur)),
	}
}

type SendGrid struct{}

func (SendGrid) Check(ctx context.Context, secret string, _ json.RawMessage) Result {
	code, body, err := doJSON(ctx, http.MethodGet, "https://api.sendgrid.com/v3/user/credits", map[string]string{
		"Authorization": "Bearer " + secret,
	}, nil)
	if err != nil {
		return Result{Status: models.StatusError, Error: err.Error()}
	}
	if code == 404 {
		// credits endpoint may not exist for all plans — fall back to auth ping
		c2, _, err2 := doJSON(ctx, http.MethodGet, "https://api.sendgrid.com/v3/user/profile", map[string]string{
			"Authorization": "Bearer " + secret,
		}, nil)
		if err2 != nil {
			return Result{Status: models.StatusError, Error: err2.Error()}
		}
		if c2 >= 400 {
			return Result{Status: models.StatusError, Error: fmt.Sprintf("sendgrid HTTP %d", c2)}
		}
		return Result{Status: models.StatusUnknown, Summary: "key valid; credits endpoint unavailable"}
	}
	if code >= 400 {
		return Result{Status: models.StatusError, Error: fmt.Sprintf("sendgrid HTTP %d", code), Summary: truncate(body)}
	}
	var parsed struct {
		Remain  float64 `json:"remain"`
		Total   float64 `json:"total"`
		Used    float64 `json:"used"`
	}
	_ = json.Unmarshal(body, &parsed)
	return Result{
		Status:   models.StatusOK,
		Balance:  fptr(parsed.Remain),
		Currency: "credits",
		SpendAmount: fptr(parsed.Used),
		SpendPeriod: "plan",
		Summary:  fmt.Sprintf("remain=%.0f used=%.0f total=%.0f", parsed.Remain, parsed.Used, parsed.Total),
	}
}

type Gemini struct{}

func (Gemini) Check(ctx context.Context, secret string, _ json.RawMessage) Result {
	url := "https://generativelanguage.googleapis.com/v1beta/models?key=" + secret
	code, body, err := doJSON(ctx, http.MethodGet, url, nil, nil)
	if err != nil {
		return Result{Status: models.StatusError, Error: err.Error()}
	}
	if code >= 400 {
		return Result{Status: models.StatusError, Error: fmt.Sprintf("gemini HTTP %d", code), Summary: truncate(body)}
	}
	return Result{Status: models.StatusUnknown, Summary: "key valid; GCP billing not exposed via API key"}
}

type Pinecone struct{}

func (Pinecone) Check(ctx context.Context, secret string, meta json.RawMessage) Result {
	host := metaString(meta, "index_host", "host", "PINECONE_INDEX_HOST")
	if host == "" {
		code, body, err := doJSON(ctx, http.MethodGet, "https://api.pinecone.io/indexes", map[string]string{
			"Api-Key":      secret,
			"Accept":       "application/json",
			"X-Pinecone-Api-Version": "2025-01",
		}, nil)
		if err != nil {
			return Result{Status: models.StatusError, Error: err.Error()}
		}
		if code >= 400 {
			return Result{Status: models.StatusError, Error: fmt.Sprintf("pinecone HTTP %d", code), Summary: truncate(body)}
		}
		return Result{Status: models.StatusUnknown, Summary: "key valid; usage not exposed"}
	}
	host = strings.TrimRight(host, "/")
	code, body, err := doJSON(ctx, http.MethodGet, host+"/describe_index_stats", map[string]string{
		"Api-Key": secret,
	}, nil)
	if err != nil {
		return Result{Status: models.StatusError, Error: err.Error()}
	}
	if code >= 400 {
		return Result{Status: models.StatusError, Error: fmt.Sprintf("pinecone HTTP %d", code), Summary: truncate(body)}
	}
	return Result{Status: models.StatusUnknown, Summary: "index reachable; usage not exposed"}
}

type LiveKit struct{}

func (LiveKit) Check(ctx context.Context, secret string, meta json.RawMessage) Result {
	// LiveKit cloud keys need API key+secret JWT; without project URL we only mark unknown if both present
	key := metaString(meta, "api_key", "LIVEKIT_API_KEY")
	if key == "" || secret == "" {
		return Result{Status: models.StatusUnknown, Summary: "store LIVEKIT_API_KEY in meta and secret as API secret; balance not exposed"}
	}
	return Result{Status: models.StatusUnknown, Summary: "credentials stored; LiveKit balance not exposed via simple API"}
}

type Soniox struct{}

func (Soniox) Check(ctx context.Context, secret string, meta json.RawMessage) Result {
	base := metaString(meta, "api_base", "SONIOX_API_BASE")
	if base == "" {
		base = "https://api.soniox.com"
	}
	code, body, err := doJSON(ctx, http.MethodGet, strings.TrimRight(base, "/")+"/v1/models", map[string]string{
		"Authorization": "Bearer " + secret,
	}, nil)
	if err != nil {
		return Result{Status: models.StatusError, Error: err.Error()}
	}
	if code >= 400 {
		return Result{Status: models.StatusError, Error: fmt.Sprintf("soniox HTTP %d", code), Summary: truncate(body)}
	}
	return Result{Status: models.StatusUnknown, Summary: "key valid; balance not exposed"}
}

type Sarvam struct{}

func (Sarvam) Check(ctx context.Context, secret string, _ json.RawMessage) Result {
	code, body, err := doJSON(ctx, http.MethodGet, "https://api.sarvam.ai/text-to-speech", map[string]string{
		"api-subscription-key": secret,
	}, nil)
	if err != nil {
		return Result{Status: models.StatusError, Error: err.Error()}
	}
	// GET may 405 but auth headers accepted differently; treat 401/403 as bad
	if code == 401 || code == 403 {
		return Result{Status: models.StatusError, Error: "invalid Sarvam key", Summary: truncate(body)}
	}
	return Result{Status: models.StatusUnknown, Summary: fmt.Sprintf("probe HTTP %d; balance not exposed", code)}
}

type GenericHTTP struct{}

func (GenericHTTP) Check(_ context.Context, _ string, _ json.RawMessage) Result {
	return Result{Status: models.StatusUnknown, Summary: "no checker for this provider; key stored only"}
}

func truncate(b []byte) string {
	s := string(b)
	if len(s) > 300 {
		return s[:300] + "…"
	}
	return s
}
