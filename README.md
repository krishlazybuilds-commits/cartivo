# Cartivo

An e-commerce storefront built with Django REST Framework and Next.js.

## Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.12, Django 5.1, DRF 3.15, SimpleJWT |
| Database | PostgreSQL 16+ (SQLite for quick local testing) |
| Frontend | Next.js 14, React 18 |

## Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 16+ running locally (e.g. via pgAdmin)

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

## Running locally

**Option A — one command (Windows, opens two terminal windows):**

```powershell
.\run-dev.ps1
```

**Option B — manually in two separate terminals:**

```bash
# Terminal 1 — backend
cd backend
.venv\Scripts\activate      # Windows
python manage.py runserver  # → http://localhost:8000

# Terminal 2 — frontend
cd frontend
npm run dev                 # → http://localhost:3000
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api/ |
| Django admin | http://localhost:8000/admin/ |

---

## Useful commands

```bash
# Re-seed catalog (safe to run multiple times)
python manage.py seed_catalog

# Wipe and re-seed from scratch
python manage.py seed_catalog --flush

# Run backend tests
python manage.py test
```

---

## Project structure

```
cartivo/
├── backend/
│   ├── apps/
│   │   ├── accounts/   # auth, user profile
│   │   ├── catalog/    # categories, products, seed command
│   │   ├── cart/       # cart + cart items
│   │   └── orders/     # order creation + history
│   ├── config/         # Django settings, URLs
│   ├── media/          # uploaded/seeded product images
│   └── manage.py
├── frontend/
│   └── app/
│       ├── components/
│       ├── lib/        # api.js, auth.js, cart.js
│       └── ...pages
├── run-dev.ps1         # one-command dev launcher (Windows)
└── .github/workflows/  # CI: backend tests + frontend build
```
