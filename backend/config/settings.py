"""
Django settings for the Cartivo e-commerce backend.

Configuration is environment-driven via a .env file (see .env.example).
Audit completed: SEC-01 resolved.
"""

from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv
import os
import secrets
import sys

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env if present.
load_dotenv(BASE_DIR / ".env")


def env_bool(key: str, default: bool = False) -> bool:
    return os.getenv(key, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(key: str, default: str = "") -> list[str]:
    raw = os.getenv(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# --- Core security -----------------------------------------------------------
# Resolve DEBUG first so the SECRET_KEY guard below can tell local development
# apart from production. Defaults to False so an unset DJANGO_DEBUG fails safe
# (production mode) instead of silently serving debug error pages that leak
# stack traces, settings, and SQL. Local dev opts in via DJANGO_DEBUG=True.
DEBUG = env_bool("DJANGO_DEBUG", False)

# SECRET_KEY must be supplied via the environment. In local development (DEBUG
# on) we generate a strong, random key dynamically for convenience and security,
# but in production (DEBUG off) an unset or placeholder key is a hard error:
# the app refuses to boot rather than doing so silently.
INSECURE_SECRET_KEY = "django-insecure-change-me-in-production"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if DEBUG:
        # Generate a strong, random key dynamically for local development so we never
        # fall back to a guessable static string, while still allowing seamless zero-config startup.
        SECRET_KEY = secrets.token_urlsafe(50)
    else:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY environment variable must be set when DEBUG is False."
        )
elif not DEBUG and SECRET_KEY == INSECURE_SECRET_KEY:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY is set to the insecure development placeholder. "
        "Generate a strong key for production, e.g. "
        'python -c "import secrets; print(secrets.token_urlsafe(50))".'
    )

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

# Fail fast if DEBUG is on while serving a non-local host. DEBUG mode leaks
# tracebacks/settings/SQL and disables the secure-cookie/HSTS hardening below,
# so booting it against a real domain is almost always an accidental
# deployment misconfiguration. Anything not in the local allow-list (including
# the "*" wildcard) is treated as non-local. Skipped during tests, and
# overridable via ALLOW_DEBUG_NON_LOCAL=True for the rare intentional case
# (e.g. debugging on a remote box).
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "[::1]", "0.0.0.0", "testserver", ""}


def _is_local_host(host: str) -> bool:
    host = host.strip()
    return host in _LOCAL_HOSTS or host.endswith(".local")


if (
    DEBUG
    and "test" not in sys.argv
    and not env_bool("ALLOW_DEBUG_NON_LOCAL", False)
    and any(not _is_local_host(host) for host in ALLOWED_HOSTS)
):
    raise ImproperlyConfigured(
        "DEBUG is True but DJANGO_ALLOWED_HOSTS contains a non-local host "
        f"({', '.join(ALLOWED_HOSTS)}). DEBUG mode leaks tracebacks, settings, "
        "and SQL, and disables secure cookies/HSTS — it must never run against "
        "a deployed host. Set DJANGO_DEBUG=False for deployment (use "
        ".env.production), or set ALLOW_DEBUG_NON_LOCAL=True to override this "
        "guard intentionally."
    )


# --- Applications ------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.catalog",
    "apps.cart",
    "apps.orders",
    "apps.contact",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "config.middleware.AdminLoginRateMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# --- Database ----------------------------------------------------------------
# Defaults to SQLite; switch to Postgres by setting the DB_* env vars.
if os.getenv("DB_ENGINE"):
    DATABASES = {
        "default": {
            "ENGINE": os.getenv("DB_ENGINE", "django.db.backends.postgresql"),
            "NAME": os.getenv("DB_NAME", "cartivo"),
            "USER": os.getenv("DB_USER", "postgres"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "5432"),
            # Reuse connections across requests (seconds). Avoids the overhead
            # of opening a new Postgres connection per request in production.
            "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "60")),
            # Validate a reused connection before using it (Django 4.1+).
            "CONN_HEALTH_CHECKS": True,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


# --- Caching -----------------------------------------------------------------
# Used by DRF throttling (and available for app-level caching). In production
# with multiple Gunicorn workers, an in-memory cache would give each worker its
# own throttle counters, so set REDIS_URL to share state across workers.
REDIS_URL = os.getenv("REDIS_URL", "")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
            # Passed through to the redis-py connection pool. Short socket
            # timeouts ensure a Redis outage fails fast instead of hanging
            # request threads; a periodic health check recycles dead
            # connections so workers recover automatically once Redis is back.
            "OPTIONS": {
                "socket_connect_timeout": int(
                    os.getenv("REDIS_SOCKET_CONNECT_TIMEOUT", "5")
                ),
                "socket_timeout": int(os.getenv("REDIS_SOCKET_TIMEOUT", "5")),
                "retry_on_timeout": True,
                "health_check_interval": int(
                    os.getenv("REDIS_HEALTH_CHECK_INTERVAL", "30")
                ),
            },
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }


# --- Celery / background tasks -----------------------------------------------
# Async task queue for emails and Stripe webhook side-effects, running on the
# same Redis used for caching/throttling. Keeping email/SMTP work off the
# request cycle removes its latency from checkout and adds automatic retries.
#
# When no broker is configured (local dev/tests without Redis), tasks run
# eagerly (synchronously, inline) so the app still works without a worker.
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "") or None
CELERY_TASK_ALWAYS_EAGER = env_bool(
    "CELERY_TASK_ALWAYS_EAGER", not bool(CELERY_BROKER_URL)
)
# In eager mode don't propagate task exceptions to the caller, so a failing
# email never breaks the request flow that enqueued it.
CELERY_TASK_EAGER_PROPAGATES = False
# Acknowledge tasks only after they finish so a worker crash re-queues them.
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_TASK_TIME_LIMIT = int(os.getenv("CELERY_TASK_TIME_LIMIT", "120"))
CELERY_TASK_SOFT_TIME_LIMIT = int(os.getenv("CELERY_TASK_SOFT_TIME_LIMIT", "90"))
CELERY_TIMEZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")

# Periodic tasks (Celery Beat). Releases stock held by unpaid PENDING orders by
# cancelling + restocking those older than ORDER_EXPIRY_MINUTES, checked every
# ORDER_EXPIRY_CHECK_SECONDS. Requires the beat scheduler to be running
# (see the `beat` service in docker-compose.yml).
CELERY_BEAT_SCHEDULE = {
    "expire-pending-orders": {
        "task": "apps.orders.tasks.expire_pending_orders_task",
        "schedule": float(os.getenv("ORDER_EXPIRY_CHECK_SECONDS", "300")),
        "kwargs": {"minutes": int(os.getenv("ORDER_EXPIRY_MINUTES", "30"))},
    },
    "send-abandoned-cart-emails": {
        "task": "apps.cart.tasks.send_abandoned_cart_emails_task",
        "schedule": 3600.0, # Every hour
    },
}


# --- Auth --------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# --- DRF ---------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {
        "contact": "5/hour",
        "login": "10/min",
        "register": "5/hour",
        "password_reset": "5/hour",
        # Authenticated mutating endpoints (writes only; reads are unthrottled).
        "cart": "60/min",
        "order": "20/min",
        "payment": "10/min",
        "coupon": "10/min",
        "shipping_estimate": "30/min",
        "order_velocity": "5/hour",
        "order_lookup": "30/min",
    },
}

# --- OpenAPI schema (drf-spectacular) ----------------------------------------
SPECTACULAR_SETTINGS = {
    "TITLE": "Cartivo API",
    "DESCRIPTION": (
        "REST API for the Cartivo e-commerce platform.\n\n"
        "Authentication uses httpOnly JWT cookies. "
        "Call `POST /api/auth/csrf/` first to receive the `csrftoken` cookie, "
        "then include it as the `X-CSRFToken` header on all unsafe requests.\n\n"
        "Swagger UI is available at `/api/schema/swagger/`; "
        "Redoc at `/api/schema/redoc/`."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # Group endpoints by their app tag.
    "SCHEMA_PATH_PREFIX": r"/api/v1/",
    # Show all response codes, not just 200.
    "COMPONENT_SPLIT_PATCH": True,
    "COMPONENT_NO_READ_ONLY_REQUIRED": True,
    # Cookie-based JWT security scheme.
    "SECURITY": [{"cookieAuth": []}],
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "cookieAuth": {
                "type": "apiKey",
                "in": "cookie",
                "name": "access_token",
                "description": (
                    "httpOnly JWT access token set by `POST /api/auth/token/`. "
                    "Pair with the `X-CSRFToken` header on unsafe requests."
                ),
            }
        }
    },
}

# Disable throttling during the test suite so shared-IP rate limits don't cause
# flaky failures when many requests run in one process.
if "test" in sys.argv:
    REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {
        key: None for key in REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
    }
    # Run Celery tasks inline during tests so they execute without a broker.
    CELERY_TASK_ALWAYS_EAGER = True

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.getenv("JWT_ACCESS_MINUTES", "60"))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.getenv("JWT_REFRESH_DAYS", "7"))
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}


# --- Auth cookies ------------------------------------------------------------
# JWTs are delivered as httpOnly cookies (XSS-safe) instead of in the response
# body. AUTH_COOKIE_SECURE must be True in production (HTTPS). For cross-origin
# requests the cookie SameSite must be "Lax" (same parent domain) or "None"
# (different domains, requires Secure=True). Set AUTH_COOKIE_DOMAIN to a shared
# parent domain (e.g. ".example.com") when frontend and backend are on
# different subdomains.
AUTH_COOKIE = os.getenv("AUTH_COOKIE_NAME", "access_token")
AUTH_REFRESH_COOKIE = os.getenv("AUTH_REFRESH_COOKIE_NAME", "refresh_token")
AUTH_COOKIE_SECURE = env_bool("AUTH_COOKIE_SECURE", not DEBUG)
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "Lax")
AUTH_COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN") or None


# --- Google Sign-In ----------------------------------------------------------
# OAuth 2.0 Web client ID from Google Cloud Console. The frontend uses it to
# request an ID token (Google Identity Services); the backend verifies that
# token's signature and audience against this same value. Leave blank to
# disable Google sign-in. The matching public value is exposed to the browser
# as NEXT_PUBLIC_GOOGLE_CLIENT_ID.
GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")


# --- CORS --------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
CORS_ALLOW_CREDENTIALS = True


# --- CSRF --------------------------------------------------------------------
# The SPA reads the csrftoken cookie and echoes it back in the X-CSRFToken
# header on unsafe requests. Trusted origins are required by Django for
# cross-origin POSTs.
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
CSRF_COOKIE_SAMESITE = AUTH_COOKIE_SAMESITE
CSRF_COOKIE_SECURE = AUTH_COOKIE_SECURE
CSRF_COOKIE_DOMAIN = AUTH_COOKIE_DOMAIN
# Must stay readable by JavaScript so the SPA can send it back in a header.
CSRF_COOKIE_HTTPONLY = False


# --- Production security ------------------------------------------------------
# These hardening settings only take effect when DEBUG is False, so local
# development over http is unaffected. Each is overridable via env var.
# Management commands that load settings but never serve HTTP requests. These
# skip network/credential validation so Docker builds and migrations work
# without full production env vars.
_SKIP_NETWORK_VALIDATION = {"test", "collectstatic", "migrate", "makemigrations", "check"}

if not DEBUG:
    # Validate ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, and CSRF_TRUSTED_ORIGINS in production.
    # We skip these checks during tests and non-serving management commands (collectstatic,
    # migrate) that load settings but never handle HTTP requests, so Docker builds and
    # migrations can run with DEBUG=False without requiring full production env vars.
    if not _SKIP_NETWORK_VALIDATION.intersection(sys.argv):
        # Validate ALLOWED_HOSTS in production to prevent Host Header Injection
        if not ALLOWED_HOSTS:
            raise ImproperlyConfigured(
                "DJANGO_ALLOWED_HOSTS environment variable must be set when DEBUG is False."
            )
        if "*" in ALLOWED_HOSTS:
            raise ImproperlyConfigured(
                "DJANGO_ALLOWED_HOSTS cannot contain the wildcard '*' in production. "
                "Please specify explicit allowed domains."
            )

        # Validate CORS_ALLOWED_ORIGINS in production to prevent unauthorized cross-origin requests
        if not CORS_ALLOWED_ORIGINS:
            raise ImproperlyConfigured(
                "CORS_ALLOWED_ORIGINS must be set when DEBUG is False to allow cross-origin requests securely."
            )
        for origin in CORS_ALLOWED_ORIGINS:
            if "*" in origin:
                raise ImproperlyConfigured(
                    f"CORS_ALLOWED_ORIGINS cannot contain wildcards ('*') in production. "
                    f"Invalid origin: '{origin}'."
                )
            if not origin.startswith("https://"):
                raise ImproperlyConfigured(
                    f"CORS_ALLOWED_ORIGINS must use secure HTTPS in production. "
                    f"Invalid origin: '{origin}'."
                )

        # Validate CSRF_TRUSTED_ORIGINS in production to prevent CSRF bypasses
        if not CSRF_TRUSTED_ORIGINS:
            raise ImproperlyConfigured(
                "CSRF_TRUSTED_ORIGINS must be set when DEBUG is False."
            )
        for origin in CSRF_TRUSTED_ORIGINS:
            if "*" in origin:
                raise ImproperlyConfigured(
                    f"CSRF_TRUSTED_ORIGINS cannot contain wildcards ('*') in production. "
                    f"Invalid origin: '{origin}'."
                )
            if not origin.startswith("https://"):
                raise ImproperlyConfigured(
                    f"CSRF_TRUSTED_ORIGINS must use secure HTTPS in production. "
                    f"Invalid origin: '{origin}'."
                )

    # Redirect all http requests to https.
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    # Trust the X-Forwarded-Proto header set by a TLS-terminating proxy/load balancer.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

    # HTTP Strict Transport Security: force https for the configured duration.
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", True)
    SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", True)

    # Session cookies sent over https only; auth/CSRF cookies already follow
    # AUTH_COOKIE_SECURE which defaults to (not DEBUG).
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = AUTH_COOKIE_SAMESITE

    # Misc hardening headers.
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"


# --- Internationalization ----------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True


# --- Static & media ----------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Serve compressed, cache-busted static files via WhiteNoise in production.
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Media (user uploads) storage. Defaults to the local filesystem. Set USE_S3=True
# to store uploads on any S3-compatible object store — AWS S3, Cloudflare R2,
# Backblaze B2, or a self-hosted/free MinIO — via django-storages. This is
# required for horizontal scaling so uploads aren't trapped on one container's
# disk. Local dev keeps using the filesystem (no cloud account needed).
USE_S3 = env_bool("USE_S3", False)
if USE_S3:
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME", "")
    AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME", "") or None
    # Custom endpoint for non-AWS providers (R2 / B2 / MinIO). Leave unset for AWS S3.
    AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL", "") or None
    # Public host used to build media URLs (e.g. a CDN domain, or the browser-
    # reachable MinIO host:port/bucket). Leave unset to derive from the bucket.
    AWS_S3_CUSTOM_DOMAIN = os.getenv("AWS_S3_CUSTOM_DOMAIN", "") or None
    # URL scheme for generated media links ("https:" or "http:").
    AWS_S3_URL_PROTOCOL = os.getenv("AWS_S3_URL_PROTOCOL", "https:")
    AWS_S3_USE_SSL = env_bool("AWS_S3_USE_SSL", True)
    # MinIO/some providers need path-style addressing rather than virtual-host.
    AWS_S3_ADDRESSING_STYLE = os.getenv("AWS_S3_ADDRESSING_STYLE", "path")
    # Serve objects via public URLs (no signed query string) when the bucket is
    # public-read. Set True to require signed URLs for a private bucket.
    AWS_QUERYSTRING_AUTH = env_bool("AWS_QUERYSTRING_AUTH", False)
    AWS_DEFAULT_ACL = None
    AWS_S3_FILE_OVERWRITE = False
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}
    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Stripe ------------------------------------------------------------------
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# --- Catalog -----------------------------------------------------------------
# Products at or below this stock level trigger a low-stock alert email to admins.
LOW_STOCK_THRESHOLD = int(os.getenv("LOW_STOCK_THRESHOLD", "5"))

# Default currency for Stripe charges and price display.
DEFAULT_CURRENCY = os.getenv("DEFAULT_CURRENCY", "usd")

# --- Site media assets -------------------------------------------------------
# Background video for the auth pages, served via /api/auth-video/ (a redirect).
# Defaults to a free, license-clear scenery clip (Pexels). For production,
# prefer self-hosting a compressed clip (e.g. in your S3/MinIO media bucket) and
# pointing this at it, rather than hotlinking a third-party CDN.
AUTH_VIDEO_URL = os.getenv(
    "AUTH_VIDEO_URL",
    "https://videos.pexels.com/video-files/3571264/3571264-hd_1920_1080_30fps.mp4",
)

# --- Email -------------------------------------------------------------------
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
# Fall back to a non-empty sender so mail still works when SMTP creds aren't
# configured (dev/CI). An empty From/recipient causes send_mail to silently
# drop the message (recipients() is empty -> nothing sent).
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "no-reply@cartivo.local")
# Where contact-form submissions are delivered. Defaults to the support inbox
# (or the configured SMTP user) and is always non-empty.
CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", EMAIL_HOST_USER or DEFAULT_FROM_EMAIL)


# --- Production startup validation -------------------------------------------
# Fail fast if critical service credentials are missing in production. In dev
# mode these default to empty strings (payments are mocked or skipped), but in
# production an empty key means silent failures — charges won't process, uploads
# won't work, emails won't send. Better to crash on boot than discover at 2 AM.
if not DEBUG and not _SKIP_NETWORK_VALIDATION.intersection(sys.argv):
    _missing = []

    # Stripe: required for checkout to function
    if not STRIPE_SECRET_KEY:
        _missing.append("STRIPE_SECRET_KEY")
    if not STRIPE_WEBHOOK_SECRET:
        _missing.append("STRIPE_WEBHOOK_SECRET")

    # S3: required when USE_S3 is enabled (horizontal scaling)
    if USE_S3:
        if not os.getenv("AWS_ACCESS_KEY_ID", ""):
            _missing.append("AWS_ACCESS_KEY_ID")
        if not os.getenv("AWS_SECRET_ACCESS_KEY", ""):
            _missing.append("AWS_SECRET_ACCESS_KEY")
        if not os.getenv("AWS_STORAGE_BUCKET_NAME", ""):
            _missing.append("AWS_STORAGE_BUCKET_NAME")

    # Email: required for order confirmations and password resets
    if EMAIL_BACKEND == "django.core.mail.backends.smtp.EmailBackend":
        if not EMAIL_HOST_USER:
            _missing.append("EMAIL_HOST_USER")
        if not EMAIL_HOST_PASSWORD:
            _missing.append("EMAIL_HOST_PASSWORD")

    if _missing:
        raise ImproperlyConfigured(
            f"Missing required environment variables for production: {', '.join(_missing)}. "
            "Set these in your deployment environment or .env.production file."
        )


# --- Logging -----------------------------------------------------------------
# Structured console logging. Level is env-driven (default INFO; use DEBUG
# locally for more detail). Container/platform log collectors capture stdout.
LOG_LEVEL = os.getenv("DJANGO_LOG_LEVEL", "INFO").upper()

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": LOG_LEVEL,
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        # Log unexpected 500s from request handling.
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
    },
}


# --- Error monitoring (optional) ---------------------------------------------
# If SENTRY_DSN is set and sentry-sdk is installed, enable error tracking.
# No-op otherwise, so local/dev runs don't require Sentry.
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[DjangoIntegration()],
            environment=os.getenv("SENTRY_ENVIRONMENT", "production" if not DEBUG else "development"),
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.0")),
            send_default_pii=False,
        )
    except ImportError:
        import logging

        logging.getLogger("apps").warning(
            "SENTRY_DSN is set but sentry-sdk is not installed; error monitoring disabled."
        )
