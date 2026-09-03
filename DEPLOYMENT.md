# Deployment Guide

This guide covers deploying the ITAD Platform beyond the local `docker compose`
demo — for a client demo on a small VM, and notes on hardening for production.

---

## 1. Environments

The application reads all configuration from environment variables (see
`.env.example`). Never commit real values.

Required for any deployed environment:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy URL, e.g. `postgresql+psycopg2://user:pw@host:5432/db` |
| `SECRET_KEY` | 32+ byte random string. Generate with `openssl rand -hex 32` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT lifetime (default 720 = 12h) |
| `BACKEND_CORS_ORIGINS` | Comma-separated allowed origins |
| `ENVIRONMENT` | `production` in prod; controls whether `/api/v1/meta/demo-users` returns anything |
| `SEED_ON_STARTUP` | `false` in production after first boot |
| `DEMO_PASSWORD` | Only used by the seed script; ignore in prod |

Frontend build-time variables (baked into the Vite bundle):

| Variable | Description |
| --- | --- |
| `VITE_API_BASE_URL` | Where the SPA sends REST calls. `/api/v1` if same-origin behind nginx |
| `VITE_WS_BASE_URL` | WebSocket base, e.g. `/api/v1/ws` |

---

## 2. Client demo on a single VM (recommended fastest path)

Requires: any Linux VM with 2 vCPU / 4GB RAM, Docker + docker compose, ports 80/443
open.

```bash
# On the VM
git clone <this repo> itad && cd itad
cp .env.example .env
sed -i "s|SECRET_KEY=.*|SECRET_KEY=$(openssl rand -hex 32)|" .env
docker compose up --build -d
```

Frontend is now at `http://<vm-ip>:5173`, backend at `:8000`.

### Add HTTPS + a domain (Caddy — 5 minutes)

Put a Caddy proxy in front of nginx. `Caddyfile`:

```
itad.example.com {
    reverse_proxy localhost:5173
}
```

`docker run -d --network host -v $PWD/Caddyfile:/etc/caddy/Caddyfile caddy`
handles automatic Let's Encrypt certs.

---

## 3. Production hardening checklist

**Secrets**
- [ ] Rotate `SECRET_KEY` (invalidates all existing JWTs).
- [ ] Set a strong PostgreSQL password and use a secrets manager (AWS SSM, Vault, etc.).
- [ ] Remove the seeded demo users, or at minimum change their passwords.

**Database**
- [ ] Point `DATABASE_URL` at a managed PostgreSQL (RDS, Cloud SQL, Aiven).
- [ ] Enable daily automated backups + PITR.
- [ ] Set `SEED_ON_STARTUP=false`.
- [ ] Run migrations explicitly (see Alembic section below) rather than relying on
      `Base.metadata.create_all`.

**Backend**
- [ ] Run behind a reverse proxy (nginx / ALB / Cloud Run).
- [ ] Set `ENVIRONMENT=production` and disable `/docs` if desired (edit `main.py`).
      This also causes `GET /api/v1/meta/demo-users` to return
      `{enabled: false, password: null, users: []}` so the login screen no
      longer advertises demo credentials.
- [ ] Restrict `BACKEND_CORS_ORIGINS` to your actual frontend origin(s).
- [ ] Add gunicorn/uvicorn workers: `uvicorn app.main:app --workers 4`.
- [ ] Configure log shipping (JSON logs → CloudWatch / Loki).

**Frontend**
- [ ] Rebuild image with correct `VITE_API_BASE_URL` for the target env.
- [ ] Serve behind a CDN if traffic warrants it (Cloudflare, CloudFront).
- [ ] Add a Content-Security-Policy header in `nginx.conf` for stricter XSS defence.

**Auth / users**
- [ ] Create real admin accounts via the `/users` page, delete demo ones.
- [ ] Consider adding SSO (OAuth / SAML) — the JWT layer is easy to swap.

**Monitoring**
- [ ] Point Uptime checks at `GET /health` (backend) and `/healthz` (frontend nginx).
- [ ] Add Sentry (or equivalent) to both backend (`sentry-sdk[fastapi]`) and
      frontend (`@sentry/react`).

---

## 3.1 Realtime / WebSocket proxy configuration

The frontend uses a WebSocket for live inventory events but **falls back to
REST polling automatically** if the socket cannot be established or drops.
Deployments do not need to expose the WebSocket for the app to work — they
just get a nicer UX (sub-second updates instead of ~20s cadence) when they do.

If you want the realtime path, your reverse proxy must:

- Forward `/api/v1/ws/...` with the `Upgrade` and `Connection` headers
  intact. The bundled `frontend/nginx.conf` already does this:
  ```
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $connection_upgrade;
  proxy_read_timeout 3600s;
  ```
- **Not** buffer WebSocket frames (nginx doesn't for upgraded connections;
  most CDNs need an explicit opt-in — e.g., Cloudflare's WebSocket support
  toggle).
- Keep the idle timeout ≥ 60s. The client heartbeats every 25s, so anything
  above that will keep the connection alive; anything below will churn.

### Ops visibility

- The sidebar status pill shows the current state to any signed-in user:
  green = WS connected, amber = connecting, gray = unsupported, red =
  reconnecting (falling back to polling).
- The polling loop refetches inventory-related queries every **20 seconds**
  when the socket is down. Expect a small step up in `/api/v1/assets`,
  `/api/v1/dashboard`, `/api/v1/movements`, and `/api/v1/audit-logs`
  request rates whenever a large fraction of clients cannot open the socket.
- On the server, the `manager` module logs disconnects; broadcast failures
  are swallowed so they never affect the underlying mutation.

---

## 3.2 Seed configuration

The seed script (`backend/scripts/seed.py`) is deterministic — the same DB
+ same seed = same data. Controls:

| Variable / arg | Purpose |
| --- | --- |
| `SEED_ON_STARTUP` | Whether `app/startup.py` runs the seed on boot |
| `DEMO_PASSWORD`   | Password given to all seeded users (default `Demo123!`) |
| `target_assets`   | Passed to `seed_all(target_assets=…)` — default **500** |

The default (500 assets) is a good demo size. For a bigger dataset (e.g.,
a load-test demo) call `run_seed` directly with a higher target — or use
the dedicated load-gen helper which is optimised for volume rather than
per-asset realism:

```bash
docker compose exec backend python -m scripts.generate_load --count 10000
```

For an empty prod DB: set `SEED_ON_STARTUP=false` and skip the script.

---

## 4. Alembic migrations

The MVP creates schema via `Base.metadata.create_all` on startup. This is fine
for the demo but for production you want reproducible migrations.

Generate the first migration once the schema is stable:

```bash
cd backend
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Then remove/skip the `create_all` fallback in `app/startup.py` and run
`alembic upgrade head` as part of your deploy pipeline (or in a
`command:` override in docker-compose).

---

## 5. Backups & restore

**PostgreSQL logical dump (docker compose):**

```bash
docker compose exec postgres pg_dump -U itad itad > backup_$(date +%F).sql
```

**Restore:**

```bash
cat backup_2026-09-03.sql | docker compose exec -T postgres psql -U itad -d itad
```

Managed services (RDS / Cloud SQL) handle this automatically — enable PITR.

---

## 6. Scaling notes (10k+ assets)

The MVP is designed to scale on a single small instance:

- Composite indexes on the hot query paths (`customer_id+status`,
  `warehouse_id+zone_id`, `status+condition`).
- Server-side pagination + sorting for the DataGrid — the browser never
  loads the whole table.
- WebSocket broadcasts carry only IDs; clients refetch the affected slice.
- Bulk moves are transactional (all-or-nothing per batch).

Load-test with the built-in script:

```bash
cd backend
python -m scripts.generate_load --count 10000
python -m scripts.benchmark
```

The `benchmark` script measures list-assets and dashboard-build times so you
can validate p95 latency budgets on your target hardware.

---

## 7. CI/CD sketch

The repo has no pipeline wired up yet, but the smallest useful one:

```yaml
# .github/workflows/ci.yml (illustrative)
jobs:
  backend:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r backend/requirements.txt
      - run: cd backend && pytest -q
  frontend:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci && npm run build
```

Once green, build + push both Docker images (`backend/Dockerfile`,
`frontend/Dockerfile`) and deploy via your platform of choice.

---

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Cannot connect to PostgreSQL` on first boot | `docker compose logs postgres` — usually port 5432 is already bound on host. Change the mapping. |
| Frontend loads but API calls 404 | Check nginx.conf `proxy_pass` line and that the backend container is named `backend`. |
| 401 loop after login | `SECRET_KEY` changed between token issue and verification. Re-login. |
| Import CSV rejected | First row must contain `asset_tag, customer_code, device_type` at minimum. See `BulkImportPage` example. |
| Bcrypt error about password length | Fixed — `security.py` clamps to 72 bytes before hashing. |
| Sidebar shows red "Reconnecting — polling" but the app still works | The WebSocket upgrade is being blocked (proxy / CDN / corporate firewall). App keeps polling every 20s so it's usable; check `Upgrade`/`Connection` headers are forwarded by every hop. |
| Sidebar shows gray "Polling (WS unsupported)" | Browser has no `WebSocket` global (very rare — old embedded / restricted context). App is fully functional over REST polling. |
| Realtime status stays amber "Connecting…" indefinitely | The socket handshake succeeds but the client never sees `open`. Usually a proxy that terminates the connection immediately — increase `proxy_read_timeout` and confirm `proxy_http_version 1.1`. |
| Login screen not showing demo users | Set `ENVIRONMENT=development` (or `demo`/`local`) — `/api/v1/meta/demo-users` intentionally returns `enabled: false` outside dev/demo envs. |
