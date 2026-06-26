from rest_framework import serializers

from .models import GeneratedMedia


class GeneratedMediaSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = GeneratedMedia
        fields = [
            "id",
            "media_type",
            "prompt",
            "model_name",
            "file",
            "file_url",
            "status",
            "task_id",
            "error_message",
            "aspect_ratio",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "task_id",
            "error_message",
            "file",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class GenerateRequestSerializer(serializers.Serializer):
    media_type = serializers.ChoiceField(choices=GeneratedMedia.MediaType.choices)
    prompt = serializers.CharField(max_length=2000)
    aspect_ratio = serializers.ChoiceField(
        choices=["1:1", "16:9", "9:16", "4:3", "3:4"],
        default="1:1",
    )
    model_name = serializers.CharField(max_length=80, required=False)
