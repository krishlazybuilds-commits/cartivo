"""Small endpoints that serve configurable site media assets.

Keeps the actual asset source in one place (an env var) so the frontend can
reference a stable internal URL and the underlying file can be swapped without
a frontend deploy.
"""

from django.conf import settings
from django.http import HttpResponseRedirect, HttpResponseNotFound


def auth_video(request):
    """Redirect to the configured auth-page background video.

    The frontend points its <video> at this stable URL (/api/auth-video/); the
    real source is set via AUTH_VIDEO_URL. The CDN it redirects to handles
    HTTP range requests, so video seeking/looping works without proxying bytes
    through this server.
    """
    url = getattr(settings, "AUTH_VIDEO_URL", "")
    if not url:
        return HttpResponseNotFound("No auth video configured.")
    return HttpResponseRedirect(url)
