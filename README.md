# Agni Key Monitor

Small internal tool to store Agni third-party API keys (encrypted), check whether credit is still available, and show status/spend on a dashboard.

- **Admin:** manage projects, team members, keys; trigger checks
- **Viewer:** dashboard + project list (never sees raw secrets)
- **Projects** own team members; keys belong to a project + **env** (`prod` / `staging` / `testing` / `other`)
- Dashboard is **project-wise** (filter, summary, team); alerts include project + team
- Low/exhausted credit alerts via **local Periskope / WhatsAppX** and **Agni calling**
- Runs on the **existing Oracle Free Tier VM** — own Docker Compose stack (Postgres + API + UI). No new VM. Does not use `agniai_db`.

## Stack

- Backend: Go (Gin) + Postgres 16
- Frontend: Next.js 14
- Deploy: Docker Compose (`agni-keymon`)

## Quick start (local)

```bash
cp .env.example .env
# Set JWT_SECRET, APP_ENCRYPTION_KEY (openssl rand -hex 32), ADMIN_*, POSTGRES_PASSWORD
docker compose up --build
```

UI: `http://127.0.0.1:3095`  
API health: `http://127.0.0.1:8095/api/health`

## Providers

Balance/spend when the provider exposes it: OpenAI, Anthropic, Twilio, Plivo, Telnyx, Stripe, SendGrid.  
Auth ping / unknown balance: Gemini, Pinecone, LiveKit, Soniox, Sarvam, and any other provider string.

For Twilio/Plivo, put `account_sid` / `auth_id` in the key **meta** JSON (or `SID:TOKEN` in the secret).

## Ops notes

- Never commit `.env` or production secrets into git.
- Rotate any credentials that were pasted into chat before adding them here.
- See [deploy/README.md](deploy/README.md) for Oracle VM ports and optional Caddy.
