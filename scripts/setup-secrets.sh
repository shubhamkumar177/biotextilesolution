#!/usr/bin/env bash
# Creates or updates the app secret in AWS Secrets Manager (eu-west-1).
# Existing values are kept unless overridden via environment variables.
#
# Default: Google Workspace SMTP relay (smtp-relay.gmail.com:587), approved by server IP, no password.
#   SMTP_USER=you@yourdomain SMTP_HOST=smtp.gmail.com SMTP_PORT=465 ./scripts/setup-secrets.sh  # app-password mode (prompts, hidden)
#   LEAD_NOTIFY_TO=a@x.com,b@y.com ./scripts/setup-secrets.sh  # change alert recipients
set -euo pipefail

REGION=eu-west-1
SECRET_ID="${APP_SECRET_ID:-biotextile/prod}"

existing="$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$SECRET_ID" \
  --query SecretString --output text 2>/dev/null || echo '{}')"
get() { python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get(sys.argv[2],""))' "$existing" "$1"; }

ADMIN_USER="${ADMIN_USER:-$(get ADMIN_USER)}";             ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(get ADMIN_PASSWORD)}"; ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-32)}"
LEAD_NOTIFY_FROM="${LEAD_NOTIFY_FROM:-$(get LEAD_NOTIFY_FROM)}"
LEAD_NOTIFY_TO="${LEAD_NOTIFY_TO:-$(get LEAD_NOTIFY_TO)}"
SMTP_HOST="${SMTP_HOST:-$(get SMTP_HOST)}";                SMTP_HOST="${SMTP_HOST:-smtp-relay.gmail.com}"
SMTP_PORT="${SMTP_PORT:-$(get SMTP_PORT)}";                SMTP_PORT="${SMTP_PORT:-587}"
SMTP_EHLO_NAME="${SMTP_EHLO_NAME:-$(get SMTP_EHLO_NAME)}"
SMTP_USER_OLD="$(get SMTP_USER)"
SMTP_USER="${SMTP_USER:-$SMTP_USER_OLD}"
SMTP_PASS="${SMTP_PASS:-}"
if [ -z "$SMTP_PASS" ]; then
  if [ -n "$SMTP_USER" ] && [ "$SMTP_USER" != "$SMTP_USER_OLD" -o -z "$(get SMTP_PASS)" ]; then
    read -r -s -p "App password for $SMTP_USER (input hidden): " SMTP_PASS; echo
  else
    SMTP_PASS="$(get SMTP_PASS)"
  fi
fi
SMTP_PASS="${SMTP_PASS// /}"   # Google shows app passwords with spaces

export ADMIN_USER ADMIN_PASSWORD LEAD_NOTIFY_FROM LEAD_NOTIFY_TO SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_EHLO_NAME

umask 077
tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
python3 - "$tmp" <<'PY'
import json, os, sys
keys = ["ADMIN_USER", "ADMIN_PASSWORD", "LEAD_NOTIFY_FROM", "LEAD_NOTIFY_TO", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_EHLO_NAME"]
json.dump({k: os.environ[k] for k in keys}, open(sys.argv[1], "w"))
PY

if [ "$existing" = '{}' ] && ! aws secretsmanager describe-secret --region "$REGION" --secret-id "$SECRET_ID" >/dev/null 2>&1; then
  aws secretsmanager create-secret --region "$REGION" --name "$SECRET_ID" \
    --description "Bio Textile Solution UK website config" \
    --secret-string "file://$tmp" --query ARN --output text >/dev/null
else
  aws secretsmanager put-secret-value --region "$REGION" --secret-id "$SECRET_ID" \
    --secret-string "file://$tmp" --query ARN --output text >/dev/null
fi
echo "Saved '$SECRET_ID' ($REGION). SMTP: ${SMTP_USER:-relay, no login} via $SMTP_HOST:$SMTP_PORT → alerts to ${LEAD_NOTIFY_TO:-<not set>}"
