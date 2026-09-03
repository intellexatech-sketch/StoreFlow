# ITAD Platform — IT Asset Disposition, Reverse Logistics & Recycling

A production-grade MVP for managing the full lifecycle of returned/end-of-life IT
assets: collection, intake, warehousing, processing, testing, resale, recycling,
and certified disposition. Built for a demo to a real client, but designed
to scale to 10,000+ assets per instance.

---

## Stack

**Backend**
- Python 3.11+, FastAPI, Pydantic v2
- SQLAlchemy 2.0 (typed `Mapped[]`), PostgreSQL 16 (JSONB) with SQLite dev fallback
- Alembic scaffolding
- JWT auth (python-jose) + bcrypt password hashing (72-byte clamp)
- WebSocket real-time inventory events with best-effort broadcast
- `/meta` endpoints expose enums / vocabularies so the SPA has zero hardcoded lists
- CSV + PDF reports (reportlab)
- Deterministic realistic seed dataset (`random.Random(20260903)`)
- Pytest test suite (14 tests, ephemeral SQLite)

**Frontend**
- React 18 + TypeScript 5 + Vite 6
- MUI 6 (`@mui/material`, `@mui/x-data-grid`)
- TanStack Query 5 for server state (staleTime 15s, refetch on focus + reconnect)
- Recharts for dashboard visualisations
- React Router 6 with role-guarded routes
- notistack for global snackbars
- `RealtimeProvider` — global WebSocket lifecycle with exponential-backoff reconnect,
  heartbeats, stale-connection detection, and automatic REST-polling fallback

**Infra**
- Multi-stage Docker builds
- `docker compose` orchestrates postgres + backend + frontend (nginx)
- Frontend nginx reverse-proxies `/api/*` and WebSocket to backend

---

## Quick start (Docker)

```bash
# 1. Copy env template
cp .env.example .env      # edit SECRET_KEY for anything non-demo

# 2. Bring the stack up
docker compose up --build

# 3. Open the app
#    Frontend:  http://localhost:5173
#    Backend:   http://localhost:8000/docs
```

On first boot (`SEED_ON_STARTUP=true`) the backend runs a deterministic seed
that gives the app a lived-in feel:

- **10 demo users** across every role
- **20 customers** across finance, health, retail, semiconductor, logistics,
  education, media, energy, government, hospitality — each with realistic
  address, contact, and industry
- **4 warehouses** (Newark, Oakland, Dallas, Atlanta) with 8 zones each —
  receiving, testing, sanitize, resale-ready, recycle-hold, hazmat, etc.
- **50+ real device models** across laptop / desktop / server / networking /
  mobile / tablet / monitor / printer / peripheral, each with a realistic
  MSRP feeding a depreciation-based resale value
  (`base_msrp * 0.72^age_years * condition_factor`)
- **~500 assets by default** (override via `target_assets`), each with a
  realistic 2-5 step movement history following the true status lifecycle
  (COLLECTION → IN_TRANSIT → RECEIVED → …), timestamped over the last year
- **LOGIN audit entries** per user so the audit log demo isn't empty

The RNG seed (`20260903`) is fixed, so re-seeding the same DB gives the same
data — great for demos and screenshots.

### Demo accounts (password `Demo123!` for all)

| Email | Role | What they can do |
| --- | --- | --- |
| `admin@example.com` | ADMIN | Everything (users, audit, force overrides) |
| `intake@example.com` | INTAKE | Receive assets, create lots, move to zones |
| `processing@example.com` | PROCESSING | Change condition/status, process assets |
| `sales@example.com` | SALES | View + mark ready for resale + reports |
| `compliance@example.com` | COMPLIANCE | View audit log + compliance reports |

The `GET /api/v1/meta/demo-users` endpoint returns the seeded accounts (with
default password) so the login screen can offer one-click sign-in. The
response shape is `{ enabled, password, users: [...] }`; `enabled` is `false`
and `users` is empty when `ENVIRONMENT` is anything other than
`development / dev / demo / local / test` — so production never leaks the
demo credentials.

---

## Local dev (without Docker)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
export DATABASE_URL=sqlite:///./dev.db   # or a local postgres URL
export SECRET_KEY=dev-secret
python -m app.startup                    # creates schema + seeds
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev                              # http://localhost:5173, proxies to :8000
```

---

## Business flow

```
COLLECTION → IN_TRANSIT → RECEIVED → PROCESSING → TESTING
   ├──> READY_FOR_RESALE → SOLD
   ├──> READY_FOR_RECYCLING → RECYCLED
   └──> DISPOSED
Also: ON_HOLD (any stage, admin only)
```

Status transitions are validated by `app.core.enums.ALLOWED_TRANSITIONS`. Non-admin
users must follow valid paths; ADMIN can `force=true` to override.

---

## Features implemented

- **Asset CRUD** with duplicate guard on tag/serial/barcode
- **Search + filter** by customer, status, condition, warehouse, device type
- **Server-side paginated inventory grid** with bulk-select
- **Barcode scan** page (scanner-friendly focus + monospace input)
- **Bulk import** via CSV with per-row error reporting + downloadable error CSV
- **Bulk move** across warehouses/zones with transactional rollback
- **Movement history** per asset + global movements view
- **Real-time updates with graceful fallback** — WebSocket broadcasts
  `ASSET_MOVED` / `STATUS_CHANGED` when reachable; when the socket is blocked
  or drops, the app auto-switches to REST polling every 20s so data still
  flows. See [Realtime & offline behavior](#realtime--offline-behavior) below.
- **Dashboard** with 8 stat tiles + status/condition/customer/zone charts
- **Reports** (CSV + PDF) — inventory, per-customer, per-lot, movement history,
  recycling cert, disposition cert, audit trail
- **RBAC** on every route via `require_roles(...)` dependency
- **Audit log** for every mutating action, viewable + exportable by COMPLIANCE
- **JWT auth** with token stored in localStorage, 401 → redirect to login

---

## Realtime & offline behavior

The core data consistency contract is: **PostgreSQL + REST is the source of
truth. WebSockets are a best-effort enhancement, not a requirement.**

**Backend**
- Every mutation commits to PostgreSQL first, then does a fire-and-forget
  broadcast on the `/api/v1/ws/inventory` socket via
  `websocket/manager.py:broadcast_sync`. Broadcast failures never affect the
  DB state or the HTTP response — the row is already committed.
- The WebSocket handler accepts optional JWT via `?token=`, answers client
  `{"event":"ping"}` frames with `{"event":"pong"}`, and never lets a socket
  error take down the endpoint.

**Frontend (`src/contexts/RealtimeContext.tsx`)**
- Feature-detects `WebSocket`. If absent, status becomes `unsupported` and
  polling starts immediately.
- On disconnect: reconnects with capped exponential backoff (1s → 64s),
  reset to 0 on `window:online` or tab becoming visible.
- Sends a client heartbeat every 25s and, if no traffic is seen for 90s
  while the socket claims `OPEN`, force-closes to trigger a reconnect
  (dead-peer detection).
- When status is anything other than `open`, invalidates the
  `['assets', 'dashboard', 'movements', 'audit']` React Query keys every 20s
  so the UI keeps refreshing. When the socket reopens, polling stops.
- React Query is tuned for the polling path too: `staleTime: 15s`,
  `refetchOnWindowFocus: true`, `refetchOnReconnect: true`.
- The sidebar shows a colour-coded status pill:
  green = connected, amber = connecting, gray = unsupported (polling), red =
  reconnecting (polling in the meantime).

Behaviourally: if your reverse proxy strips WebSocket upgrades, if the tab is
backgrounded for hours, if the machine goes offline and comes back, or if the
backend is briefly redeployed — the app keeps working and self-heals.

---

## Testing

```bash
cd backend
python -m pytest -q
```

Tests use an ephemeral SQLite DB (see `tests/conftest.py`) and cover:
- Auth (login, `/me`, protected route rejection)
- Asset create + duplicate-serial rejection
- Search + scan
- Movement + status change (allowed and disallowed transitions)
- CSV import happy path + bad-header rejection
- RBAC (intake user cannot access `/users` or `/audit-logs`)

Load / benchmarking helpers:
```bash
python -m scripts.generate_load --count 10000    # seed to N assets
python -m scripts.benchmark                       # list + dashboard timings
```

---

## Project layout

```
backend/
  app/
    api/v1/          # FastAPI routers (one per resource)
    core/            # config, database, security, enums, deps, exceptions
    models/          # SQLAlchemy 2.0 ORM (Mapped[])
    schemas/         # Pydantic v2 request/response models
    services/        # Business logic (asset, import, report, dashboard, audit)
    websocket/       # ConnectionManager + broadcast helpers
    main.py          # create_app() + exception handlers
    startup.py       # DB wait + schema create + optional seed
  scripts/           # seed, generate_load, benchmark
  tests/             # pytest suite
  Dockerfile
  requirements.txt

frontend/
  src/
    api/             # axios client + endpoint wrappers
    components/      # StatusChip, ProtectedRoute, BulkMoveDialog
    contexts/        # AuthContext, RealtimeContext (WS + polling fallback)
    layouts/         # DashboardLayout (dark sidebar, mobile drawer, status pill)
    pages/           # 16 route pages
    types/           # Shared TS types + enum constants
    theme.ts         # MUI theme
    vite-env.d.ts    # ImportMetaEnv typing for VITE_* vars
  Dockerfile         # multi-stage node -> nginx
  nginx.conf         # SPA fallback + /api reverse proxy + WS upgrade

docker-compose.yml
.env.example
DEPLOYMENT.md
README.md
```

---

## API — key endpoints

All under `/api/v1`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | JWT login |
| GET  | `/auth/me` | Current user |
| GET  | `/assets` | Paginated + filterable list |
| POST | `/assets` | Create asset |
| POST | `/assets/scan` | Look up by barcode/serial/tag |
| POST | `/assets/{id}/move` | Move single asset + record movement |
| POST | `/assets/bulk-move` | Move many, transactional |
| POST | `/assets/{id}/status` | Status change with transition validation |
| POST | `/assets/{id}/condition` | Condition change |
| GET  | `/dashboard` | Aggregated dashboard payload |
| GET  | `/movements` | Paginated movement history |
| GET  | `/audit-logs` | Compliance audit trail (ADMIN/COMPLIANCE) |
| GET  | `/reports/{kind}?format=csv\|pdf` | Report exports |
| POST | `/import/assets` | CSV bulk import (multipart) |
| GET  | `/meta/enums` | All enums the SPA needs (statuses, conditions, device types, movement types, roles, allowed transitions, audit vocab) |
| GET  | `/meta/demo-users` | Seeded demo users + default password (dev/demo env only) |
| GET  | `/meta/app-info` | App name, version, environment |
| WS   | `/ws/inventory` | Real-time events (optional; token via `?token=`) |

Interactive docs: <http://localhost:8000/docs>

---

## Notes on scaling to 10k+ assets

- Composite indexes on `assets`: `(customer_id, status)`, `(warehouse_id, zone_id)`,
  `(status, condition)`, plus unique on `asset_tag`, `serial_number`, `barcode`.
- Server-side pagination and sorting on the DataGrid (no in-memory loads).
- WebSocket broadcasts small event envelopes only (id + type), clients refetch
  the affected slice via React Query invalidation.
- `bulk_move` batches within a single transaction; failures roll back.

---

## Security

- Passwords hashed with bcrypt (12 rounds, 72-byte input clamp).
- JWTs signed HS256 with `SECRET_KEY` from env (rotate for production).
- RBAC enforced server-side by dependency injection; UI hides forbidden actions
  but the source of truth is the API.
- Audit log records `user_id`, IP, old/new values on every mutation.

See `DEPLOYMENT.md` for production hardening (TLS, secret rotation, backups).
