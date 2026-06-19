# Backend image: Django + Gunicorn, static served via WhiteNoise.
FROM python:3.12-slim@sha256:d764629ce0ddd8c71fd371e9901efb324a95789d2315a47db7e4d27e78f1b0e9

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install Python dependencies first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collect static files into STATIC_ROOT for WhiteNoise to serve.
# DJANGO_SECRET_KEY is only needed so settings imports cleanly at build time.
RUN DJANGO_SECRET_KEY=build-only DJANGO_DEBUG=False python manage.py collectstatic --noinput

EXPOSE 8000

# Run as non-root for defense in depth.
RUN adduser --disabled-password --no-create-home appuser
USER appuser

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
