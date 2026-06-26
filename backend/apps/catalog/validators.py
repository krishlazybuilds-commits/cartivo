import logging

from django.core.exceptions import ValidationError

from .constants import (
    MAX_IMAGE_SIZE,
    MAX_IMPORT_FILE_SIZE,
    _XLSX_MAGIC,
    _ALLOWED_CSV_MIMETYPES,
    _ALLOWED_XLSX_MIMETYPES,
)

logger = logging.getLogger(__name__)


def validate_image_size(file):
    """Reject product images larger than MAX_IMAGE_SIZE."""
    size = getattr(file, "size", None)
    if size is not None and size > MAX_IMAGE_SIZE:
        mb = MAX_IMAGE_SIZE // (1024 * 1024)
        raise ValidationError(f"Image must be {mb} MB or smaller.")


def _check_xlsx_magic(file) -> bool:
    """Check the file starts with the ZIP magic bytes (PK\x03\x04).
    .xlsx files are ZIP archives and always start with this signature.
    Seeks back to the start after reading."""
    header = file.read(len(_XLSX_MAGIC))
    file.seek(0)
    return header == _XLSX_MAGIC


def _check_text_content(file) -> bool:
    """Check the file contains valid UTF-8 text.
    Reads the first 8 KB and attempts UTF-8 decoding. Non-text binary
    content (or files of a different encoding) will fail decode or
    contain null bytes, both of which are rejected.
    Seeks back to the start after reading."""
    sample = file.read(8192)
    file.seek(0)
    try:
        sample.decode("utf-8-sig")
    except (UnicodeDecodeError, UnicodeError):
        return False
    # Reject files containing null bytes (binary content disguised as text).
    if b"\x00" in sample:
        return False
    return True


def validate_import_file(file):
    """Validate that the uploaded file is a genuine CSV or XLSX file.

    Checks performed:
    1. File size cap (20 MB).
    2. Content-Type header (if provided) matches the expected MIME type.
    3. Magic bytes for .xlsx files (ZIP archive header).
    4. Valid UTF-8 text content for .csv files (no null bytes).

    This complements the existing extension-based check and provides
    defense-in-depth against renamed malicious files.

    Raises ``ValidationError`` with a user-facing message on any failure.
    """
    # --- Size check ---
    size = getattr(file, "size", None)
    if size is not None and size > MAX_IMPORT_FILE_SIZE:
        mb = MAX_IMPORT_FILE_SIZE // (1024 * 1024)
        raise ValidationError(f"Import file must be {mb} MB or smaller.")

    # --- Determine expected type from filename extension ---
    filename = getattr(file, "name", "") or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # --- Content-Type header check ---
    content_type = (getattr(file, "content_type", "") or "").lower()
    if ext == "csv":
        if content_type and content_type not in _ALLOWED_CSV_MIMETYPES:
            logger.warning(
                "Import rejected: CSV file '%s' has unexpected Content-Type '%s'",
                filename,
                content_type,
            )
            raise ValidationError(
                "Uploaded CSV file has an unexpected content type. "
                "Please upload a valid CSV file."
            )
        # Verify the file is valid UTF-8 text (no binary content).
        if not _check_text_content(file):
            logger.warning(
                "Import rejected: CSV file '%s' is not valid UTF-8 text",
                filename,
            )
            raise ValidationError(
                "Uploaded CSV file does not contain valid text data. "
                "Please upload a valid UTF-8 encoded CSV file."
            )

    elif ext == "xlsx":
        if content_type and content_type not in _ALLOWED_XLSX_MIMETYPES:
            logger.warning(
                "Import rejected: XLSX file '%s' has unexpected Content-Type '%s'",
                filename,
                content_type,
            )
            raise ValidationError(
                "Uploaded XLSX file has an unexpected content type. "
                "Please upload a valid .xlsx file."
            )
        # Verify the file is a genuine ZIP archive (magic bytes).
        if not _check_xlsx_magic(file):
            logger.warning(
                "Import rejected: XLSX file '%s' fails magic-byte check",
                filename,
            )
            raise ValidationError(
                "Uploaded .xlsx file does not appear to be a valid Excel file. "
                "Please upload a valid .xlsx file."
            )
    # else: unknown extension — the view will handle this before processing
    # by falling through to CSV parsing (which will gracefully fail on its own).
