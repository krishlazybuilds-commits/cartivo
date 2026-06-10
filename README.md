# Cartivo

An e-commerce storefront built with Django REST Framework and Next.js.

## Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.12, Django 5.1, DRF 3.15, SimpleJWT (cookie-based), Celery |
| Database | PostgreSQL 16+ (SQLite for quick local testing), Redis |
| Frontend | Next.js 14, React 18 |
| Object Storage | S3-compatible (MinIO bundled for local, swap for R2/B2/S3) |
| CI/CD | GitHub Actions (tests, lint, audit, Docker build), Dependabot |

## Key Features

- **Cookie-based JWT auth** with CSRF protection (XSS-safe)
- **Guest checkout** — no account required to purchase
- **Shipping & tax estimate** shown on cart and checkout before payment
- **Stripe Checkout** integration with full webhook lifecycle (paid, expired, failed, refunded)
- **Async emails** via Celery on Redis with retries and exponential backoff
- **Auto-cancel stale orders** — Celery Beat expires unpaid PENDING orders and restocks
- **OpenAPI docs** — Swagger UI and Redoc auto-generated via drf-spectacular
- **Rate limiting** on all write endpoints (cart, orders, payment, auth)
- **S3-compatible media storage** for horizontal scaling (MinIO in dev, zero cost)
- **CI security gates** — pip-audit (blocking), npm audit (informational), ESLint, Docker builds

## Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 16+ running locally (or use Docker Compose)
- Redis (or use Docker Compose)

---

## Setup

### 1. Clone

```bash
git clone https://github.com/krishlazybuilds-commits/cartivo.git
cd cartivo
```

### 2. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Create `backend/.env` (copy from the example):

```bash
cp .env.example .env
```

Then edit `.env` and fill in the database section:

```env
DJANGO_SECRET_KEY=change-me-to-a-long-random-string
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

JWT_ACCESS_MINUTES=60
JWT_REFRESH_DAYS=7

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

DB_ENGINE=django.db.backends.postgresql
DB_NAME=cartivo
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432

# Redis (needed for Celery + cache/throttling in multi-worker mode)
REDIS_URL=redis://localhost:6379/0
```

Create the Postgres database (run once):

```bash
# Using psql
createdb -U postgres cartivo

# Or in pgAdmin: right-click Databases → Create → Database → name: cartivo
```

#### Stripe (payments)

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and log in:
   ```bash
   stripe login
   ```
2. In a separate terminal, start the webhook forwarder:
   ```bash
   stripe listen --forward-to http://localhost:8000/api/orders/webhook/
   ```
3. Copy the `whsec_...` signing secret printed on startup into `backend/.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
   You also need your test keys from the [Stripe dashboard](https://dashboard.stripe.com/test/apikeys):
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

Run migrations and seed the catalog:

```bash
python manage.py migrate
python manage.py seed_catalog
```

Create an admin account (optional, for /admin):

```bash
python manage.py createsuperuser
```

### 3. Frontend

```bash
cd ../frontend
npm install
```

No `.env` needed for local dev — the API base URL defaults to `http://localhost:8000`.

---

## Running Locally

**Option A — Docker Compose (recommended, full stack):**

```bash
docker compose up --build
```

This starts: PostgreSQL, Redis, MinIO (S3-compatible storage), Django (with migrations), Celery worker, Celery beat, and the Next.js frontend. Media uploads go to MinIO automatically.

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api/ |
| API Docs (Swagger) | http://localhost:8000/api/schema/swagger/ |
| API Docs (Redoc) | http://localhost:8000/api/schema/redoc/ |
| Django admin | http://localhost:8000/admin/ |
| MinIO Console | http://localhost:9001 (minioadmin / minioadmin) |

**Option B — manually in separate terminals:**

```bash
# Terminal 1 — backend
cd backend
.venv\Scripts\activate
python manage.py runserver        # → http://localhost:8000

# Terminal 2 — Celery worker (processes emails, webhook side-effects)
cd backend
.venv\Scripts\activate
celery -A config worker --loglevel=info

# Terminal 3 — Celery beat (periodic tasks: order expiry)
cd backend
.venv\Scripts\activate
celery -A config beat --loglevel=info

# Terminal 4 — frontend
cd frontend
npm run dev                       # → http://localhost:3000
```

> Without Redis/Celery running, tasks execute eagerly (inline) so the app still works — just without retries or the order-expiry schedule.

---

## API Documentation

Interactive API docs are always available:

- **Swagger UI:** http://localhost:8000/api/schema/swagger/
- **Redoc:** http://localhost:8000/api/schema/redoc/
- **Raw OpenAPI schema:** http://localhost:8000/api/schema/

Authentication uses httpOnly JWT cookies. Call `GET /api/auth/csrf/` first to receive the CSRF cookie, then include it as the `X-CSRFToken` header on all unsafe requests.

---

## Guest Checkout

Customers can add items to their cart and check out without creating an account:

- The guest cart lives in `localStorage` on the client
- At checkout, the guest provides an email address and cart items are submitted in the request body
- On sign-in, any guest cart items are automatically merged into the server-side cart
- Order confirmation emails are sent to the guest email

---

## Background Tasks (Celery)

| Task | Schedule | Description |
|---|---|---|
| `send_order_confirmation_task` | On order create | Emails order summary to customer |
| `send_payment_confirmed_task` | On Stripe payment | Emails payment confirmation |
| `expire_pending_orders_task` | Every 5 min (Beat) | Cancels + restocks orders unpaid for 30 min |

All email tasks retry with exponential backoff (max 5 retries). Configuration:

```env
CELERY_BROKER_URL=redis://localhost:6379/0
ORDER_EXPIRY_MINUTES=30
ORDER_EXPIRY_CHECK_SECONDS=300
```

---

## Object Storage (Media)

By default, media (product images, uploads) is stored on the local filesystem. Set `USE_S3=True` to use any S3-compatible object store:

| Provider | Cost | Notes |
|---|---|---|
| MinIO (Docker Compose) | Free | Bundled, zero config |
| Cloudflare R2 | Free tier, no egress fees | Recommended for production |
| Backblaze B2 | Cheap | Free egress to Cloudflare |
| AWS S3 | Pay-per-use | Standard, most integrations |

Docker Compose bundles MinIO automatically. For external providers, set these env vars:

```env
USE_S3=True
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=cartivo-media
AWS_S3_ENDPOINT_URL=https://...  # leave blank for AWS S3
```

---

## Useful Commands

```bash
# Re-seed catalog (safe to run multiple times)
python manage.py seed_catalog

# Wipe and re-seed from scratch
python manage.py seed_catalog --flush

# Run backend tests
python manage.py test

# Run frontend tests + lint
cd frontend && npm test && npm run lint

# Generate OpenAPI schema
python manage.py spectacular --file schema.yml

# Manually expire stale pending orders
python manage.py expire_pending_orders
python manage.py expire_pending_orders --minutes 60 --dry-run
```

---

## CI / CD

GitHub Actions runs on every push to `main` and on pull requests:

| Job | What it does |
|---|---|
| Backend tests | Postgres service, migrate, `manage.py test`, deploy check |
| Frontend | `npm ci`, lint, test, build |
| Security audit | `pip-audit` (blocking), `npm audit` (informational) |
| Docker build | Builds backend + frontend images (layer-cached) |

**Dependabot** is configured for weekly update PRs on pip, npm, GitHub Actions, and Docker base images.

---

## Project Structure

```
cartivo/
├── backend/
│   ├── apps/
│   │   ├── accounts/   # auth, user profile, admin user management
│   │   ├── catalog/    # categories, products, seed command
│   │   ├── cart/       # cart + cart items (server-side, auth users)
│   │   ├── orders/     # checkout, Stripe, webhooks, shipping estimate
│   │   └── contact/    # contact form
│   ├── config/
│   │   ├── settings.py
│   │   ├── celery.py   # Celery app + beat schedule
│   │   ├── throttling.py # rate-limit classes
│   │   ├── health.py   # /api/health/ readiness probe
│   │   └── urls.py     # schema, swagger, redoc + app routes
│   ├── media/          # uploaded/seeded product images (or S3)
│   ├── Dockerfile
│   └── manage.py
├── frontend/
│   ├── app/
│   │   ├── components/ # AddToCart, Nav, etc.
│   │   ├── lib/        # api.js, auth.js, cart.js (guest + server)
│   │   ├── cart/       # cart page with shipping estimate
│   │   ├── checkout/   # guest + auth checkout
│   │   └── ...pages
│   ├── middleware.js   # auth guards (orders/profile/admin only)
│   ├── .eslintrc.json
│   └── Dockerfile
├── docker-compose.yml  # full stack: db, redis, minio, backend, worker, beat, frontend
├── .github/
│   ├── workflows/ci.yml
│   └── dependabot.yml
└── README.md
```
