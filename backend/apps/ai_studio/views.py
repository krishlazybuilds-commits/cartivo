from django.conf import settings
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import GeneratedMedia
from .serializers import GenerateRequestSerializer, GeneratedMediaSerializer


class IsStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_staff


@api_view(["POST"])
@permission_classes([IsStaff])
def generate_media(request):
    """Create a GeneratedMedia record and dispatch a Celery task."""
    serializer = GenerateRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    # Check if GEMINI_API_KEY is configured
    if not getattr(settings, "GEMINI_API_KEY", None):
        return Response(
            {"error": "GEMINI_API_KEY is not configured on the server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    media = GeneratedMedia.objects.create(
        media_type=data["media_type"],
        prompt=data["prompt"],
        model_name=data.get("model_name", ""),
        aspect_ratio=data.get("aspect_ratio", "1:1"),
        created_by=request.user,
    )

    # Dispatch Celery task
    if media.media_type == GeneratedMedia.MediaType.IMAGE:
        from .tasks import generate_image_task

        task = generate_image_task.delay(str(media.id))
    else:
        from .tasks import generate_video_task

        task = generate_video_task.delay(str(media.id))

    media.task_id = task.id
    media.status = GeneratedMedia.Status.PROCESSING
    media.save(update_fields=["task_id", "status"])

    return Response(
        GeneratedMediaSerializer(media, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


class GeneratedMediaViewSet(viewsets.ReadOnlyModelViewSet):
    """List and retrieve generated media. Delete is allowed for staff."""

    serializer_class = GeneratedMediaSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        qs = GeneratedMedia.objects.filter(created_by=self.request.user)
        media_type = self.request.query_params.get("type")
        if media_type in ("image", "video"):
            qs = qs.filter(media_type=media_type)
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Delete the file from storage before deleting the record
        if instance.file:
            instance.file.delete(save=False)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
