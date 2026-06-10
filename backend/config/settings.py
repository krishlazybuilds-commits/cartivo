"""
Django settings for the Cartivo e-commerce backend.

Configuration is environment-driven via a .env file (see .env.example).
"""

from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
import os
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
SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure-change-me-in-production",
)
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")


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
    "DEFAULT_THROTTLE_RATES": {
        "contact": "5/hour",
        "login": "10/min",
        "register": "5/hour",
        "password_reset": "5/hour",
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
if not DEBUG:
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

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Stripe ------------------------------------------------------------------
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

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
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER)


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
