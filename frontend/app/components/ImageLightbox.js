"use client";

import { useEffect, useCallback } from "react";

export default function ImageLightbox({ images, activeIndex, onClose, name }) {
  const lockScroll = useCallback((lock) => {
    document.body.style.overflow = lock ? "hidden" : "";
  }, []);

  useEffect(() => {
    lockScroll(true);
    return () => lockScroll(false);
  }, [lockScroll]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function prev(e) {
    e.stopPropagation();
    onClose(activeIndex > 0 ? activeIndex - 1 : images.length - 1);
  }

  function next(e) {
    e.stopPropagation();
    onClose(activeIndex < images.length - 1 ? activeIndex + 1 : 0);
  }

  if (!images.length) return null;
  const current = images[activeIndex];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn 0.15s ease",
      }}
      onClick={onClose}
      role="dialog"
      aria-label={`Image ${activeIndex + 1} of ${images.length}`}
      aria-modal="true"
    >
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close lightbox"
        style={{
          position: "absolute", top: "1rem", right: "1.5rem",
          background: "none", border: "none",
          color: "#fff", fontSize: "2rem", cursor: "pointer",
          lineHeight: 1, zIndex: 1, opacity: 0.7,
        }}
      >
        ✕
      </button>

      <span
        style={{
          position: "absolute", bottom: "1.5rem", left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.6)", fontSize: "0.9rem",
        }}
      >
        {activeIndex + 1} / {images.length}
      </span>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous image"
            style={{
              position: "absolute", left: "1rem", top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.1)", border: "none",
              color: "#fff", fontSize: "1.8rem", cursor: "pointer",
              width: 48, height: 48, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1,
            }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next image"
            style={{
              position: "absolute", right: "1rem", top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.1)", border: "none",
              color: "#fff", fontSize: "1.8rem", cursor: "pointer",
              width: 48, height: 48, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1,
            }}
          >
            ›
          </button>
        </>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "90vw", height: "90vh",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.image}
          alt={current.alt || name || `Image ${activeIndex + 1}`}
          style={{
            maxWidth: "100%", maxHeight: "100%",
            objectFit: "contain", borderRadius: 4,
          }}
        />
      </div>
    </div>
  );
}
