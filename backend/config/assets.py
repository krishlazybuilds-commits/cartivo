"""Small endpoints that serve configurable site media assets.

Keeps the actual asset source in one place (an env var) so the frontend can
reference a stable internal URL and the underlying file can be swapped without
a frontend deploy.
"""

from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpResponseNotFound, HttpResponseRedirect


def auth_video(request):
    """Serve the auth-page background video.

    The video file lives at ``settings.AUTH_VIDEO_PATH`` (defaults to
    *static/videos/space-loop.mp4* inside the project).  A configurable
    ``AUTH_VIDEO_URL`` env-var is still supported for environments that prefer
    to offload video serving to a CDN — if set, the view redirects there
    instead so the frontend URL stays stable regardless of the storage backend.
    """
    # If an explicit URL is configured, redirect to it (legacy CDN/workload
    # offload mode).
    url = getattr(settings, "AUTH_VIDEO_URL", "")
    if url:
        return HttpResponseRedirect(url)

    # Otherwise serve the local file.
    path = Path(getattr(settings, "AUTH_VIDEO_PATH", ""))
    if not path.is_absolute():
        path = Path(settings.BASE_DIR) / path
    if not path.exists():
        return HttpResponseNotFound("Auth video not found.")

    # Open the file and let Django stream it with the correct Content-Type.
    # The OS will handle sendfile (or equivalent) transparently on most
    # production stacks (nginx/gunicorn, Caddy, etc.).
    fh = open(path, "rb")
    return FileResponse(fh, content_type="video/mp4")
