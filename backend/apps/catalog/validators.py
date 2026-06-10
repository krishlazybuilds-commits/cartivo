from django.core.exceptions import ValidationError

# Maximum allowed product image size (bytes).
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


def validate_image_size(file):
    """Reject product images larger than MAX_IMAGE_SIZE."""
    size = getattr(file, "size", None)
    if size is not None and size > MAX_IMAGE_SIZE:
        mb = MAX_IMAGE_SIZE // (1024 * 1024)
        raise ValidationError(f"Image must be {mb} MB or smaller.")
