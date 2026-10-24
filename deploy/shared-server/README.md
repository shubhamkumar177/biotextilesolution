# Deploying on the shared Spotfluence server

Runs only the Bio Textile app container on `spotfluence-prod` (54.228.21.52). The existing
Spotfluence nginx terminates HTTPS and routes `biotextextilesolution.com` to it; the existing
Spotfluence certbot renews its certificate. Spotfluence's own config (`default.conf`) is not edited.

```
visitor ─443─▶ spotfluence-nginx-1 ─┬─ spotfluence.co.uk          ─▶ app:3000            (Spotfluence)
                                    └─ biotextextilesolution.com  ─▶ biotextile-app:3000 (this repo)
```

| Fact | Value |
|---|---|
| Spotfluence checkout | `/opt/spotfluence` (nginx config folder `/opt/spotfluence/docker/nginx`) |
| Certificates / webroot | `/srv/spotfluence/letsencrypt`, `/srv/spotfluence/certbot-webroot` |
| Shared Docker network | `spotfluence_edge` |
| Our container | `biotextile-app` (never `app` — that name belongs to Spotfluence on this network) |
| Secrets | AWS Secrets Manager `biotextile/prod` (eu-west-1), read with the instance role |
| Email | Google Workspace SMTP relay, approved for 54.228.21.52 |

## 0. One-off, from a laptop with the AWS CLI

**DNS** — point the domain at the server:

```sh
ZONE=$(aws route53 list-hosted-zones-by-name --dns-name biotextextilesolution.com \
  --query 'HostedZones[0].Id' --output text)
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE" --change-batch '{"Changes":[
 {"Action":"UPSERT","ResourceRecordSet":{"Name":"biotextextilesolution.com","Type":"A","TTL":300,"ResourceRecords":[{"Value":"54.228.21.52"}]}},
 {"Action":"UPSERT","ResourceRecordSet":{"Name":"www.biotextextilesolution.com","Type":"A","TTL":300,"ResourceRecords":[{"Value":"54.228.21.52"}]}}]}'
```

**Secret access** — let the server's role read `biotextile/prod` (read-only, this secret only):

```sh
aws iam put-role-policy --role-name spotfluence-prod-ecr-role \
  --policy-name BiotextileSecretRead --policy-document file://scripts/iam-policy.json
```

## 1. On the server — start the app

```sh
sudo git clone https://github.com/shubhamkumar177/biotextilesolution.git /opt/biotextile
cd /opt/biotextile
sudo docker compose -f deploy/shared-server/docker-compose.yml up -d --build
```

Check it:

```sh
sudo docker logs biotextile-app --tail 20          # expect: loaded secret "biotextile/prod"
sudo docker exec spotfluence-nginx-1 wget -qO- http://biotextile-app:3000/healthz   # {"ok":true}
```

## 2. On the server — certificate (DNS must already resolve to 54.228.21.52)

```sh
dig +short biotextextilesolution.com               # must print 54.228.21.52

sudo docker run --rm \
  -v /srv/spotfluence/letsencrypt:/etc/letsencrypt \
  -v /srv/spotfluence/certbot-webroot:/var/www/certbot \
  certbot/certbot:v5.8.0 certonly --webroot -w /var/www/certbot \
  -d biotextextilesolution.com -d www.biotextextilesolution.com \
  --email info@5dyogaloungewear.co.uk --agree-tos --no-eff-email --key-type ecdsa --non-interactive
```

The challenge is answered by Spotfluence's existing port-80 block; nothing else changes.
Renewal is automatic: the Spotfluence certbot container renews every certificate in that folder
and its nginx reloads every 6 hours.

## 3. On the server — route the domain (certificate must exist first)

```sh
sudo cp /opt/biotextile/deploy/shared-server/biotextile.conf /opt/spotfluence/docker/nginx/
sudo docker exec spotfluence-nginx-1 nginx -t && sudo docker exec spotfluence-nginx-1 nginx -s reload
```

If `nginx -t` fails, nothing is reloaded — remove the file and Spotfluence carries on unchanged:

```sh
sudo rm /opt/spotfluence/docker/nginx/biotextile.conf
```

## 4. Verify

```sh
curl -sI https://biotextextilesolution.com | head -1                       # HTTP/2 200
curl -sI https://www.biotextextilesolution.com | grep -i location          # → apex
curl -s -o /dev/null -w "%{http_code}\n" https://spotfluence.co.uk        # Spotfluence still 200
```

Then submit a test pilot application on the site — it should arrive at info@5dyogaloungewear.co.uk.

## Updating later

```sh
cd /opt/biotextile && sudo git pull
sudo docker compose -f deploy/shared-server/docker-compose.yml up -d --build
```

If `biotextile.conf` changes, copy it again and repeat the `nginx -t && nginx -s reload` line.

## Notes

- `biotextile.conf` is an untracked file inside the Spotfluence checkout. `git pull` keeps it;
  `git clean -fd` in `/opt/spotfluence` would delete it (copy it back and reload).
- The config resolves `biotextile-app` per request, so nginx starts and Spotfluence keeps working
  even while this app is stopped (our site then shows a 502).
- Remove completely: delete `biotextile.conf` + reload nginx, then
  `sudo docker compose -f deploy/shared-server/docker-compose.yml down`.
