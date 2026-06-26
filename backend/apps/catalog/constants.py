MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
_XLSX_MAGIC = b"PK\x03\x04"
_ALLOWED_CSV_MIMETYPES = {
    "text/csv",
    "text/plain",
    "text/comma-separated-values",
    "application/csv",
    "application/octet-stream",
}
_ALLOWED_XLSX_MIMETYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
}
