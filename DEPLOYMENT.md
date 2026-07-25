# Production deployment with GitHub Actions and Nginx

The repository deploys automatically after every successful push to `main`:

```text
GitHub push
  → npm ci, audit, type-check, build
  → standalone release artifact
  → SSH upload
  → versioned release on the server
  → atomic `current` symlink switch
  → systemd restart
  → application health check
  → automatic rollback on failure
```

Nginx terminates HTTP/TLS and proxies requests to the standalone Next.js server
on `127.0.0.1:3000`. Nginx cannot serve this application as static files
because the AutoReach BFF routes require Node.js.

## 1. Prepare the Ubuntu server

Install Node.js 22, Nginx, curl, and the utility used to create the Nginx
password file. Confirm that Node is installed at `/usr/bin/node`; otherwise
update `ExecStart` in the service template.

```bash
sudo apt update
sudo apt install nginx curl apache2-utils
node --version
command -v node
```

Create the dedicated deployment/service account and release directories:

```bash
sudo useradd --create-home --home-dir /srv/outboundos --shell /bin/bash outboundos
sudo install -d -o outboundos -g outboundos -m 755 /srv/outboundos/releases
sudo install -d -o root -g root -m 755 /etc/outboundos
```

Create `/etc/outboundos/outboundos.env`:

```env
AUTOREACH_API_URL=https://your-autoreach-api.example.com
AUTOREACH_API_SECRET=replace-with-the-production-secret
```

Protect it:

```bash
sudo chown root:root /etc/outboundos/outboundos.env
sudo chmod 600 /etc/outboundos/outboundos.env
```

Install the systemd service from this repository:

```bash
sudo cp ops/systemd/outboundos.service /etc/systemd/system/outboundos.service
sudo systemctl daemon-reload
sudo systemctl enable outboundos.service
```

Allow only the service restart required by the deployment script. Create
`/etc/sudoers.d/outboundos-deploy` with:

```text
outboundos ALL=(root) NOPASSWD: /usr/bin/systemctl restart outboundos.service
```

Then validate it:

```bash
sudo chmod 440 /etc/sudoers.d/outboundos-deploy
sudo visudo -cf /etc/sudoers.d/outboundos-deploy
```

## 2. Create the deployment SSH key

Generate a dedicated key on a trusted administrator machine:

```bash
ssh-keygen -t ed25519 -f outboundos_deploy -C "github-actions-outboundos"
```

Add `outboundos_deploy.pub` to:

```text
/srv/outboundos/.ssh/authorized_keys
```

Use these permissions:

```bash
sudo install -d -o outboundos -g outboundos -m 700 /srv/outboundos/.ssh
sudo chown outboundos:outboundos /srv/outboundos/.ssh/authorized_keys
sudo chmod 600 /srv/outboundos/.ssh/authorized_keys
```

Keep the private key only in the GitHub secret described below.

## 3. Configure Nginx

Copy the template and replace `YOUR_DOMAIN`:

```bash
sudo cp ops/nginx/outboundos.conf /etc/nginx/sites-available/outboundos
sudo sed -i 's/YOUR_DOMAIN/app.example.com/g' /etc/nginx/sites-available/outboundos
sudo ln -s /etc/nginx/sites-available/outboundos /etc/nginx/sites-enabled/outboundos
```

The current backend has no user authentication or scoped tokens. The Nginx
template therefore enables HTTP Basic Authentication. Create its password file:

```bash
sudo htpasswd -c /etc/nginx/.htpasswd-outboundos your-admin-username
sudo chown root:www-data /etc/nginx/.htpasswd-outboundos
sudo chmod 640 /etc/nginx/.htpasswd-outboundos
```

Validate and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Point the domain's DNS record at the server, then configure TLS with your
certificate provider. For example, after installing Certbot:

```bash
sudo certbot --nginx -d app.example.com
```

Do not remove Nginx authentication until the application has real user
authentication and scoped backend authorization.

## 4. Configure the GitHub production environment

In the GitHub repository, open:

```text
Settings → Environments → New environment → production
```

Add these environment variables:

| Variable | Example |
| --- | --- |
| `PRODUCTION_HOST` | `203.0.113.10` |
| `PRODUCTION_USER` | `outboundos` |
| `PRODUCTION_SSH_PORT` | `22` |
| `PRODUCTION_APP_DIR` | `/srv/outboundos` |
| `PRODUCTION_APP_PORT` | `3000` |
| `PRODUCTION_URL` | `https://app.example.com` |

Add these environment secrets:

| Secret | Value |
| --- | --- |
| `PRODUCTION_SSH_PRIVATE_KEY` | Complete contents of `outboundos_deploy` |
| `PRODUCTION_KNOWN_HOSTS` | Verified SSH host-key line for the server |

Generate the known-host line from a trusted machine:

```bash
ssh-keyscan -p 22 -H 203.0.113.10
```

Verify the reported fingerprint against the server before saving it. Do not
disable strict host-key checking.

## 5. First deployment

The first push to `main` creates `/srv/outboundos/current`, then starts the
service. The workflow can also be started manually from:

```text
GitHub → Actions → CI and production deployment → Run workflow
```

Monitor the server when validating the first release:

```bash
sudo systemctl status outboundos.service
sudo journalctl -u outboundos.service -f
curl http://127.0.0.1:3000/api/health
```

The deployment retains the five newest releases. If a new release does not
return a successful health response within 30 seconds, the script restores the
previous release and restarts the service automatically.

## Production checklist

- Protect the GitHub `production` environment and limit who can change its
  secrets and variables.
- Restrict SSH to key authentication and, where practical, GitHub Actions
  runner addresses or a private network.
- Keep `/etc/outboundos/outboundos.env` outside the release directory.
- Keep Nginx authentication enabled until application authentication exists.
- Enable HTTPS before handling real outreach data.
- Back up AutoReach's database separately; this pipeline deploys only the
  frontend.
- Add external uptime monitoring for `/api/health` and the AutoReach API.
