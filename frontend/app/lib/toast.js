"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

let _id = 0;
const MAX = 3;          // max visible toasts in the stack
const SCALE_STEP = 0.04; // each older toast shrinks by this
const Y_STEP = 8;        // px each older toast peeks above the one in front

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message, type = "success", duration = 3000) => {
      const id = ++_id;
      setToasts((t) => {
        // Keep only the last MAX-1 so the new one fits within MAX
        const next = t.length >= MAX ? t.slice(-(MAX - 1)) : t;
        return [...next, { id, message, type }];
      });
      timers.current[id] = setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  const total = toasts.length;

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((t, i) => {
        // i=total-1 is the newest (front); i=0 is the oldest (back)
        const depth = total - 1 - i;      // 0 = front, 1 = behind, 2 = further
        const scale = 1 - depth * SCALE_STEP;
        const translateY = -depth * Y_STEP;
        return (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            role="status"
            style={{
              transform: `translateY(${translateY}px) scale(${scale})`,
              transformOrigin: "bottom center",
              zIndex: total - depth,
              opacity: depth === 0 ? 1 : 1 - depth * 0.15,
              position: "absolute",
              bottom: 0,
              right: 0,
            }}
          >
            <span>{t.message}</span>
            {depth === 0 && (
              <button
                type="button"
                className="toast-close"
                aria-label="Dismiss"
                onClick={() => onDismiss(t.id)}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return () => {};
  return ctx;
}

