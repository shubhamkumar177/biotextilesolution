# Bio Textile Solution UK — landing page

Website for Bio Textile Solution UK, UK distribution partner for textile innovation.

Monolithic Node.js app (Express 5 + EJS, no frontend build step) behind nginx with
automatic Let's Encrypt certificates. Secrets live in AWS Secrets Manager (`eu-west-1`).

```
app/        Express app — src/ (server), views/ (EJS), public/ (css, js, img)
nginx/      nginx image: reverse proxy, TLS, auto-reload on cert renewal
certbot/    first issuance + renew every 12h
scripts/    setup-secrets.sh, iam-policy.json
```

## Deploy

> **Shared Spotfluence server:** follow [deploy/shared-server/README.md](deploy/shared-server/README.md) instead — it runs only the app behind Spotfluence's nginx.

Standalone server (own nginx + certbot):

1. Point DNS (`A` record for `DOMAIN` and any aliases) at the server; open ports 80/443.
2. `cp .env.example .env` and set `DOMAIN`, `DOMAIN_ALIASES`, `CERTBOT_EMAIL`.
3. AWS access for the app:
   - **EC2 (recommended):** attach an instance role with `scripts/iam-policy.json`, and set the
     instance metadata hop limit to 2 so containers can reach it:
     `aws ec2 modify-instance-metadata-options --instance-id <id> --http-put-response-hop-limit 2 --http-endpoint enabled`
   - **Other hosts:** the app mounts `~/.aws` read-only; set `AWS_PROFILE` in `.env` if not `default`.
4. `docker compose up -d --build` — done. `docker compose down` to stop.

On first boot nginx serves a temporary self-signed cert; certbot obtains the real one
and nginx reloads itself within a minute. Renewal is automatic.

## Secrets (`biotextile/prod`, eu-west-1)

| Key | Purpose |
|---|---|
| `ADMIN_USER` / `ADMIN_PASSWORD` | Basic auth for `/admin/leads.csv` (generated) |
| `LEAD_NOTIFY_TO` | Who receives pilot-application emails (comma-separated) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_EHLO_NAME` | Google Workspace SMTP relay (`smtp-relay.gmail.com:587`, TLS), approved by server IP — no password |
| `SMTP_USER` / `SMTP_PASS` | Only for app-password mode (`smtp.gmail.com:465`); leave empty for the relay |

Relay setup: Google Admin (5dyogaloungewear.co.uk) → Apps → Google Workspace → Gmail → Routing → SMTP relay service → allow the server IP, only addresses in my domains, require TLS.

## Pilot applications

Stored in the `app-data` volume as `leads.jsonl`. Export: `https://DOMAIN/admin/leads.csv`.

## Local development

```
cd app && npm install && npm run dev   # http://localhost:3000, no AWS needed
```

## Resource limits

| Service | CPU | Memory |
|---|---|---|
| app | 0.75 | 384M |
| nginx | 0.50 | 128M |
| certbot | 0.25 | 128M |
