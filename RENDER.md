# Deploying to Render

The repo ships with a **Render Blueprint** (`render.yaml`) that
provisions the whole stack — managed PostgreSQL, the FastAPI backend,
and the Vite frontend — as three separate Render resources.

Because Docker Compose isn't supported on Render, each service is its
own Render resource. The Blueprint file wires them together.

---

## What gets created

| Resource in Render | Kind | Free tier |
| --- | --- | --- |
| `itad-postgres`  | PostgreSQL 16 (managed) | 90-day expiry |
| `itad-backend`   | Web Service (Docker)    | Sleeps after 15 min idle |
| `itad-frontend`  | Static Site             | Always on, global CDN |

---

## First-time deploy (5 steps)

### 1. Push this repo to GitHub / GitLab / Bitbucket

Render's Blueprint flow reads `render.yaml` from the default branch of a
connected Git repo. Make sure `render.yaml` is committed.

### 2. Create the Blueprint in Render

- Sign in at <https://dashboard.render.com>
- **New → Blueprint**
- Connect the repository → Render detects `render.yaml`
- Give the blueprint a name (e.g. `itad-platform`) → **Apply**

Render will:

- Provision `itad-postgres`
- Build `itad-backend` from `backend/Dockerfile`
- Build `itad-frontend` with `npm ci && npm run build`

The three `sync: false` env vars (`BACKEND_CORS_ORIGINS`,
`VITE_API_BASE_URL`, `VITE_WS_BASE_URL`) will be flagged as needing
values — **leave them blank on this first pass**, we'll fill them in
next.

### 3. Grab the public URLs

Once both services have deployed, note their URLs from the Render
dashboard. They look like:

- Backend:  `https://itad-backend-<hash>.onrender.com`
- Frontend: `https://itad-frontend-<hash>.onrender.com`

### 4. Fill in the three cross-service env vars

Open each service in Render → **Environment** → edit the placeholder
values:

**itad-backend**

| Key | Value |
| --- | --- |
| `BACKEND_CORS_ORIGINS` | `https://itad-frontend-<hash>.onrender.com` |

**itad-frontend**

| Key | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://itad-backend-<hash>.onrender.com/api/v1` |
| `VITE_WS_BASE_URL`  | `wss://itad-backend-<hash>.onrender.com/api/v1/ws` |

Save. Render redeploys both services automatically (frontend rebuilds
so the new `VITE_*` values are baked into the bundle).

### 5. Log in

Visit `https://itad-frontend-<hash>.onrender.com` and sign in with any
seeded demo account (password `Demo123!`):

- `admin@example.com` (ADMIN — recommended for the tour)
- `intake@example.com`
- `processing@example.com`
- `sales@example.com`
- `compliance@example.com`

---

## What the Blueprint does under the hood

- **`DATABASE_URL`** is injected from `itad-postgres.connectionString`
  via `fromDatabase:` — no password in Git, no manual copying. The
  backend uses SQLAlchemy 2 + `psycopg2-binary`, which auto-detects the
  `postgresql://` scheme.
- **`SECRET_KEY`** uses `generateValue: true` so Render creates a
  strong random JWT signing key on first deploy and reuses it forever.
- **`ENVIRONMENT: demo`** keeps `/api/v1/meta/demo-users` enabled so
  the login screen shows the seeded accounts.
- **`SEED_ON_STARTUP: "true"`** runs the deterministic seed
  (`random.Random(20260903)`) on first boot — you get 500+ assets,
  20 customers, 4 warehouses, and a lived-in audit log without doing
  anything.
- Static-site **SPA fallback** rewrites `/*` → `/index.html` so React
  Router handles routes client-side.
- Static-site **`Cache-Control: immutable`** header applies to
  `/assets/*` since Vite ships hashed filenames.

---

## Free-tier caveats worth knowing

| Behaviour | What to expect |
| --- | --- |
| Backend sleeps after 15 min idle | First request cold-starts in ~30 s; the frontend shows a loading state |
| WebSocket drops when backend sleeps | The app already falls back to REST polling every 20 s — data still flows |
| Free Postgres expires after 90 days | Upgrade to a paid Postgres, or export/re-seed if you keep it as a demo |
| No persistent disk on free web services | Not a problem here — Postgres is the source of truth; the backend container is stateless |

---

## Updating the deployment

Any push to the tracked branch triggers `autoDeploy: true` on both
services. Blueprint changes (e.g. new env vars in `render.yaml`) are
picked up by clicking **Sync** on the blueprint page in Render.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Frontend shows "Network Error" on every API call | `VITE_API_BASE_URL` isn't set (or wrong). Set it, redeploy the frontend. |
| Browser console: `Blocked by CORS policy` | `BACKEND_CORS_ORIGINS` doesn't include your frontend's exact origin (must match scheme + host + port). |
| Login fails with "Invalid credentials" | Seed didn't run. Check backend logs for `Seeded N assets…`. Confirm `SEED_ON_STARTUP=true`. |
| WebSocket status pill red / reconnecting | Free-tier idle sleep. App falls back to polling automatically — nothing to fix. |
| Backend build fails on `psycopg2` | Shouldn't happen — the Dockerfile installs `libpq-dev` and `build-essential`. If it does, rebuild without cache from Render's manual deploy menu. |

---

## Alternative: manual dashboard setup (no Blueprint)

If you'd rather not use `render.yaml`, create each resource by hand in
the Render UI:

1. **New → PostgreSQL** — name `itad-postgres`, plan Free.
2. **New → Web Service** — connect repo, Root Directory `backend`,
   Environment `Docker`, Dockerfile Path `./Dockerfile`. Add the env
   vars listed under `itad-backend` above (paste the Postgres
   *Internal Database URL* as `DATABASE_URL`).
3. **New → Static Site** — connect repo, Root Directory `frontend`,
   Build Command `npm ci && npm run build`, Publish Directory `dist`.
   Add the two `VITE_*` env vars. Under **Redirects/Rewrites** add
   `Source: /*  Destination: /index.html  Action: Rewrite` for the SPA
   fallback.
