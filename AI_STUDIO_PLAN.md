# AI Media Studio — Implementation Plan

## Overview
Add a new **"AI Studio"** admin tab where staff users can generate images (Nano Banana 2) and videos (Veo 3.1) using Google's Gemini API, with a media library to store and manage generated content.

---

## Architecture

### Backend: New `ai_studio` Django App

```
backend/apps/ai_studio/
├── __init__.py
├── apps.py
├── models.py          # GeneratedMedia model
├── serializers.py     # DRF serializers
├── views.py           # API endpoints
├── tasks.py           # Celery async tasks for generation
├── urls.py            # Router registration
├── admin.py           # Django admin registration
└── migrations/
    └── 0001_initial.py
```

**Model: `GeneratedMedia`**
- `id` — UUID primary key
- `media_type` — choices: `image`, `video`
- `prompt` — text (the generation prompt)
- `model_name` — e.g. `nano-banana-2`, `veo-3.1`
- `file` — FileField (stored via MinIO/S3)
- `status` — choices: `pending`, `processing`, `completed`, `failed`
- `task_id` — CharField (Celery task ID for polling)
- `error_message` — TextField, nullable
- `aspect_ratio` — e.g. `1:1`, `16:9`, `9:16`
- `created_by` — FK → User
- `created_at`, `updated_at` — timestamps

**API Endpoints**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/ai-studio/generate/` | Create media, dispatch Celery task |
| GET | `/api/v1/ai-studio/media/` | List all generated media (paginated) |
| GET | `/api/v1/ai-studio/media/{id}/` | Get single media item |
| DELETE | `/api/v1/ai-studio/media/{id}/` | Delete media + file from storage |

All endpoints require `is_staff` permission.

**Celery Tasks**
- `generate_image_task(media_id, prompt, model, aspect_ratio)` — calls Gemini Nano Banana 2, saves to storage
- `generate_video_task(media_id, prompt, model, aspect_ratio)` — calls Veo 3.1, polls until done, saves MP4

---

### Frontend: Admin AI Studio Page

**New route:** `/admin/ai-studio`

**UI Sections:**
1. **Generation Form** — Toggle Image/Video, prompt textarea, aspect ratio selector, model picker, Generate button
2. **Media Library** — Grid of thumbnails with filter tabs (All/Images/Videos), status badges, auto-refresh while processing
3. **Detail Modal** — Full-size preview, prompt info, download/delete buttons

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/config/settings.py` | Add `apps.ai_studio` to `LOCAL_APPS`, add `GEMINI_API_KEY` |
| `backend/config/urls.py` | Add ai_studio URL include |
| `backend/requirements.txt` | Add `google-genai` |
| `frontend/app/components/AdminTabs.js` | Add "AI Studio" tab |
| `frontend/app/globals.css` | Add `.ai-studio-*` styles |

## Files to Create

| File | Purpose |
|------|---------|
| `backend/apps/ai_studio/__init__.py` | App init |
| `backend/apps/ai_studio/apps.py` | AppConfig |
| `backend/apps/ai_studio/models.py` | GeneratedMedia model |
| `backend/apps/ai_studio/serializers.py` | DRF serializers |
| `backend/apps/ai_studio/views.py` | API views |
| `backend/apps/ai_studio/tasks.py` | Celery tasks |
| `backend/apps/ai_studio/urls.py` | URL routing |
| `backend/apps/ai_studio/admin.py` | Django admin |
| `frontend/app/admin/ai-studio/page.js` | AI Studio page |
| `frontend/app/admin/ai-studio/layout.js` | Page metadata |

## Environment Variables

```
GEMINI_API_KEY=your_key_here
```
