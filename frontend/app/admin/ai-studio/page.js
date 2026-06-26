"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import AdminTabs from "../../components/AdminTabs";
import Reveal from "../../components/Reveal";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useAuth, authFetch, extractError } from "../../lib/auth";

const IMAGE_MODELS = [
  { value: "gemini-2.5-flash-preview-image", label: "Nano Banana 2 (Fast)" },
];
const VIDEO_MODELS = [
  { value: "veo-3.1-generate-preview", label: "Veo 3.1" },
];
const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
];

export default function AdminAiStudioPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Form state
  const [mediaType, setMediaType] = useState("image");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [modelName, setModelName] = useState(IMAGE_MODELS[0].value);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  // Library state
  const [media, setMedia] = useState([]);
  const [filter, setFilter] = useState("all");
  const [detailItem, setDetailItem] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const pollRef = useRef(null);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/login?next=/admin/ai-studio");
    else if (!user.is_staff) router.replace("/");
  }, [user, authLoading, router]);

  // Switch model when type changes
  useEffect(() => {
    if (mediaType === "image") {
      setModelName(IMAGE_MODELS[0].value);
      if (aspectRatio === "9:16") setAspectRatio("1:1");
    } else {
      setModelName(VIDEO_MODELS[0].value);
    }
  }, [mediaType]);

  // Load media
  const loadMedia = useCallback(async () => {
    try {
      const params = filter !== "all" ? `?type=${filter}` : "";
      const data = await authFetch(`/ai-studio/media/${params}`);
      setMedia(data.results ?? data);
    } catch {
      // silent
    }
  }, [filter]);

  useEffect(() => {
    if (user?.is_staff) loadMedia();
  }, [user, loadMedia]);

  // Auto-refresh while items are processing
  useEffect(() => {
    const hasProcessing = media.some(
      (m) => m.status === "processing" || m.status === "pending"
    );
    if (hasProcessing) {
      pollRef.current = setInterval(loadMedia, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [media, loadMedia]);

  // Generate
  async function handleGenerate(e) {
    e.preventDefault();
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      await authFetch("/ai-studio/generate/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: mediaType,
          prompt: prompt.trim(),
          aspect_ratio: aspectRatio,
          model_name: modelName,
        }),
      });
      setPrompt("");
      await loadMedia();
    } catch (err) {
      setGenError(extractError(err.data, err.message));
    } finally {
      setGenerating(false);
    }
  }

  // Delete
  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await authFetch(`/ai-studio/media/${pendingDelete.id}/`, {
        method: "DELETE",
      });
      setPendingDelete(null);
      setDetailItem(null);
      await loadMedia();
    } catch (err) {
      // silent
    } finally {
      setDeleting(false);
    }
  }

  // Download
  function handleDownload(item) {
    if (!item.file_url) return;
    const a = document.createElement("a");
    a.href = item.file_url;
    a.download = "";
    a.click();
  }

  const filteredMedia =
    filter === "all"
      ? media
      : media.filter((m) => m.media_type === filter);

  if (authLoading || !user?.is_staff) return null;

  return (
    <>
      <main>
        <section className="features">
          <div className="container">
            <Reveal>
              <div className="section-head">
                <span className="eyebrow">Admin</span>
                <h2>AI Studio</h2>
                <p>Generate images and videos with Google Gemini AI.</p>
              </div>
            </Reveal>

            <AdminTabs />

            <Reveal>
              <div className="admin-panel">

          {/* ─── Generation Form ─── */}
          <form className="ai-studio-form" onSubmit={handleGenerate}>
            <div className="ai-studio-type-toggle">
              <button
                type="button"
                className={`ai-studio-type-btn${mediaType === "image" ? " active" : ""}`}
                onClick={() => setMediaType("image")}
              >
                🖼 Image
              </button>
              <button
                type="button"
                className={`ai-studio-type-btn${mediaType === "video" ? " active" : ""}`}
                onClick={() => setMediaType("video")}
              >
                🎬 Video
              </button>
            </div>

            <textarea
              className="ai-studio-prompt"
              placeholder={
                mediaType === "image"
                  ? "Describe the image you want to generate... e.g. 'A sleek laptop on a minimalist white desk, studio lighting, product photography'"
                  : "Describe the video you want to generate... e.g. 'Slow cinematic pan across a premium headphone on a dark surface, soft bokeh lights'"
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              required
            />

            <div className="ai-studio-options">
              <div className="ai-studio-option">
                <label>Aspect Ratio</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                >
                  {ASPECT_RATIOS.filter((a) => {
                    if (mediaType === "video" && a.value === "4:3") return false;
                    if (mediaType === "video" && a.value === "3:4") return false;
                    return true;
                  }).map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ai-studio-option">
                <label>Model</label>
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                >
                  {(mediaType === "image" ? IMAGE_MODELS : VIDEO_MODELS).map(
                    (m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {genError && <div className="ai-studio-error">{genError}</div>}

            <button
              type="submit"
              className="btn btn-primary ai-studio-submit"
              disabled={!prompt.trim() || generating}
            >
              {generating
                ? "Generating…"
                : mediaType === "image"
                  ? "✨ Generate Image"
                  : "🎬 Generate Video"}
            </button>
          </form>

          {/* ─── Media Library ─── */}
          <div className="ai-studio-library">
            <div className="ai-studio-lib-head">
              <h2>Media Library</h2>
              <div className="ai-studio-filters">
                {["all", "image", "video"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`ai-studio-filter${filter === f ? " active" : ""}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === "all" ? "All" : f === "image" ? "🖼 Images" : "🎬 Videos"}
                  </button>
                ))}
              </div>
            </div>

            {filteredMedia.length === 0 ? (
              <div className="ai-studio-empty">
                <p>No media generated yet. Use the form above to get started.</p>
              </div>
            ) : (
              <div className="ai-studio-grid">
                {filteredMedia.map((item) => (
                  <div
                    key={item.id}
                    className="ai-studio-card"
                    onClick={() => setDetailItem(item)}
                  >
                    <div className="ai-studio-card-preview">
                      {item.media_type === "image" && item.file_url ? (
                        <img src={item.file_url} alt={item.prompt} loading="lazy" />
                      ) : item.media_type === "video" && item.file_url ? (
                        <video src={item.file_url} preload="metadata" />
                      ) : (
                        <div className="ai-studio-card-placeholder">
                          {item.media_type === "image" ? "🖼" : "🎬"}
                        </div>
                      )}

                      {/* Status overlay */}
                      {(item.status === "processing" ||
                        item.status === "pending") && (
                        <div className="ai-studio-status-overlay">
                          <div className="ai-studio-spinner" />
                          <span>Generating…</span>
                        </div>
                      )}
                      {item.status === "failed" && (
                        <div className="ai-studio-status-overlay ai-studio-failed">
                          <span>❌ Failed</span>
                        </div>
                      )}
                    </div>

                    <div className="ai-studio-card-info">
                      <span className="ai-studio-card-type">
                        {item.media_type}
                      </span>
                      <span className="ai-studio-card-ratio">
                        {item.aspect_ratio}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </Reveal>
        </div>
      </section>
    </main>

      {/* ─── Detail Modal ─── */}
      {detailItem && (
        <div
          className="ai-studio-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailItem(null);
          }}
        >
          <div className="ai-studio-modal">
            <button
              className="ai-studio-modal-close"
              onClick={() => setDetailItem(null)}
            >
              ✕
            </button>

            <div className="ai-studio-modal-preview">
              {detailItem.media_type === "image" && detailItem.file_url ? (
                <img src={detailItem.file_url} alt={detailItem.prompt} />
              ) : detailItem.media_type === "video" && detailItem.file_url ? (
                <video src={detailItem.file_url} controls autoPlay />
              ) : (
                <div className="ai-studio-modal-placeholder">
                  {detailItem.status === "processing"
                    ? "Generating…"
                    : detailItem.status === "failed"
                      ? "Generation failed"
                      : "No preview"}
                </div>
              )}
            </div>

            <div className="ai-studio-modal-info">
              <div className="ai-studio-modal-row">
                <span className="ai-studio-modal-label">Prompt</span>
                <p>{detailItem.prompt}</p>
              </div>
              <div className="ai-studio-modal-meta">
                <span>{detailItem.model_name}</span>
                <span>{detailItem.aspect_ratio}</span>
                <span>{detailItem.media_type}</span>
                <span>
                  {new Date(detailItem.created_at).toLocaleString()}
                </span>
              </div>
              {detailItem.status === "failed" && detailItem.error_message && (
                <div className="ai-studio-error ai-studio-modal-error">
                  {detailItem.error_message}
                </div>
              )}
              <div className="ai-studio-modal-actions">
                {detailItem.file_url && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleDownload(detailItem)}
                  >
                    ⬇ Download
                  </button>
                )}
                <button
                  className="btn btn-danger"
                  onClick={() => setPendingDelete(detailItem)}
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete media?"
        message="This will permanently remove the generated file. This cannot be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        destructive
      />
    </>
  );
}
