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

# Run migrations then start Gunicorn. Override in compose/orchestrator as needed.
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3"]
