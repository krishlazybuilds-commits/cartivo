# Backend image: Django + Gunicorn, static served via WhiteNoise.
FROM python:3.12-slim

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

# Start Gunicorn only. Database migrations are NOT run here: when the backend
# is scaled to multiple containers, each would otherwise run `migrate`
# concurrently and race. Migrations are applied by a dedicated one-shot step
# (see the `migrate` service in docker-compose.yml) before the app starts.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
