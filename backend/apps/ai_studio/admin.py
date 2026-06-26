from django.contrib import admin

from .models import GeneratedMedia


@admin.register(GeneratedMedia)
class GeneratedMediaAdmin(admin.ModelAdmin):
    list_display = ("id", "media_type", "model_name", "status", "created_by", "created_at")
    list_filter = ("media_type", "status")
    readonly_fields = ("id", "created_at", "updated_at")
