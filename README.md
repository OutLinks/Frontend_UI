# OutboundOS frontend

Next.js MVP interface for the AutoReach outreach pipeline.

## Configure the API

Copy `.env.example` to `.env.local` and set the AutoReach service values:

```env
AUTOREACH_API_URL=http://localhost:8000
AUTOREACH_API_SECRET=replace-with-your-autoreach-api-secret
```

Both variables are server-only. Never rename the secret to a `NEXT_PUBLIC_*`
variable. The browser calls the allowlisted `/api/autoreach/*` backend-for-
frontend route, which adds the administrative bearer token on the server.

Until user authentication and scoped backend tokens exist, deploy this as a
private internal admin application or protect it with an access gateway.

## Run locally

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`. AutoReach is a required production
dependency: if it is unavailable or not configured, the interface shows a
blocking operational error and never substitutes fabricated data.

## Supported operations

- Dashboard report and pipeline health
- Campaign generation, job polling, review, and activation
- Campaign list
- Lead list with state filtering
- Lead discovery, full-cycle, and individual-stage jobs
- Recent durable job monitoring
- Read-only runtime configuration

The sender-event endpoint is intentionally not exposed to the browser. Provider
webhooks must be signature-verified by a trusted server adapter before reaching
AutoReach.

## Production deployment

The repository includes a GitHub Actions pipeline for standalone Next.js
deployment behind Nginx with systemd, atomic releases, health checks, and
automatic rollback. See [DEPLOYMENT.md](DEPLOYMENT.md).
