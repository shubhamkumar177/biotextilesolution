#!/bin/sh
# Points /etc/nginx/ssl at the Let's Encrypt cert when it exists, otherwise at a
# self-signed placeholder so nginx can boot and serve the ACME challenge.
# A background watcher reloads nginx whenever certbot issues or renews the cert.
set -eu

: "${DOMAIN:?DOMAIN must be set}"
LE_DIR="/etc/letsencrypt/live/${DOMAIN}"
SSL_DIR=/etc/nginx/ssl
DUMMY_DIR=/etc/nginx/ssl-dummy

link_certs() {
  if [ -s "$LE_DIR/fullchain.pem" ] && [ -s "$LE_DIR/privkey.pem" ]; then
    src="$LE_DIR"
  else
    if [ ! -s "$DUMMY_DIR/fullchain.pem" ]; then
      echo "[certs] no Let's Encrypt cert yet for ${DOMAIN} — generating temporary self-signed cert"
      openssl req -x509 -nodes -newkey rsa:2048 -days 30 -subj "/CN=${DOMAIN}" \
        -keyout "$DUMMY_DIR/privkey.pem" -out "$DUMMY_DIR/fullchain.pem" >/dev/null 2>&1
    fi
    src="$DUMMY_DIR"
  fi
  ln -sfn "$src/fullchain.pem" "$SSL_DIR/fullchain.pem"
  ln -sfn "$src/privkey.pem" "$SSL_DIR/privkey.pem"
}

fingerprint() { cat "$SSL_DIR/fullchain.pem" 2>/dev/null | md5sum | cut -d' ' -f1; }

link_certs

(
  last="$(fingerprint)"
  while sleep 60; do
    link_certs
    now="$(fingerprint)"
    if [ "$now" != "$last" ] && nginx -t >/dev/null 2>&1; then
      echo "[certs] certificate changed — reloading nginx"
      nginx -s reload && last="$now"
    fi
  done
) &
