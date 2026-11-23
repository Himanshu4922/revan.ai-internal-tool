# Deploy on existing Oracle Free Tier VM

No new VM. Run alongside WhatsAppX / other stacks using different loopback ports.

## Ports (defaults)

| Service  | Host bind              | Notes                          |
|----------|------------------------|--------------------------------|
| UI       | `127.0.0.1:3095`       | Avoids WhatsAppX `:3000`       |
| API      | `127.0.0.1:8095`       | Avoids WhatsAppX `:8080`       |
| Postgres | `127.0.0.1:5433`       | Local volume only              |

Compose project name: **`agni-keymon`**.

## Steps

```bash
cd /opt/agni-keymon   # or your clone path
cp .env.example .env
# Edit .env:
#   JWT_SECRET, APP_ENCRYPTION_KEY=$(openssl rand -hex 32)
#   ADMIN_EMAIL / ADMIN_PASSWORD
#   POSTGRES_* and DATABASE_URL (password must match)
#   COOKIE_SECURE=true behind HTTPS
#   WHATSAPPX_* and CALLING_* / ALERT_CALL_* for alerts
#   CORS_ORIGINS=https://keys.your-domain

docker compose up -d --build
docker compose ps
curl -s http://127.0.0.1:8095/api/health
```

Data lives in the `postgres_data` Docker volume on this VM. Do **not** point `DATABASE_URL` at Agni prod Postgres.

## Optional Caddy snippet

```caddy
keys.internal.ravan.ai {
  reverse_proxy 127.0.0.1:3095
}
```

The Next.js app rewrites `/api/*` to the backend container (`API_INTERNAL_URL=http://backend:8080`). Browser traffic can stay on a single host/port.

## Alerts

- **WhatsApp (local Periskope / WhatsAppX only):** set `WHATSAPPX_BASE_URL` (e.g. `http://host.docker.internal:8080`), `WHATSAPPX_API_KEY` (write-scope key), and `WHATSAPPX_TO` (phone digits or `…@g.us` / `…@lid`). Do not use `api.periskope.app`.
- **Calling:** set `CALLING_API_BASE`, `CALLING_INTERNAL_KEY`, `ALERT_CALL_AGENT_ID`, `ALERT_CALL_FROM`, `ALERT_CALL_TO`, `ALERT_CALL_ORG_ID`.

Alerts fire on `low` / `exhausted` with cooldown (`ALERT_COOLDOWN_HOURS`, default 6).

## Updates

```bash
git pull
docker compose up -d --build
```
