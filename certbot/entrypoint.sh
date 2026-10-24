#!/bin/sh
# Issues the first certificate (webroot challenge via nginx), then renews every 12h.
# nginx picks up new certs automatically (see nginx/entrypoint/40-biotextile-certs.sh).
set -eu

: "${DOMAIN:?DOMAIN must be set}"
: "${CERTBOT_EMAIL:?CERTBOT_EMAIL must be set}"
WEBROOT=/var/www/certbot

domain_args="-d ${DOMAIN}"
for d in ${DOMAIN_ALIASES:-}; do domain_args="${domain_args} -d ${d}"; done

staging_arg=""
[ "${CERTBOT_STAGING:-0}" = "1" ] && staging_arg="--staging"

trap 'exit 0' TERM INT

if [ ! -s "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  until certbot certonly --webroot -w "$WEBROOT" ${domain_args} ${staging_arg} \
        --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email --non-interactive \
        --key-type ecdsa --cert-name "$DOMAIN"; do
    echo "[certbot] issuance failed — check DNS points at this server and ports 80/443 are open. Retrying in 10 min."
    sleep 600 & wait $!
  done
fi

while :; do
  certbot renew --webroot -w "$WEBROOT" --quiet --no-random-sleep-on-renew || echo "[certbot] renew failed, will retry"
  sleep 12h & wait $!
done
