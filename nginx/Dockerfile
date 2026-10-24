FROM nginx:1.27-alpine
RUN apk add --no-cache openssl \
 && mkdir -p /var/www/certbot /etc/nginx/ssl /etc/nginx/ssl-dummy \
 && rm -f /etc/nginx/conf.d/default.conf
COPY templates/ /etc/nginx/templates/
COPY entrypoint/40-biotextile-certs.sh /docker-entrypoint.d/40-biotextile-certs.sh
RUN chmod +x /docker-entrypoint.d/40-biotextile-certs.sh
