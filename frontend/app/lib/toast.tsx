"use client";

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

export type ToastFunction = (message: string, type?: ToastType, duration?: number) => number;

const ToastContext = createContext<ToastFunction | null>(null);

let _id = 0;
const MAX = 3;          // max visible toasts in the stack
const SCALE_STEP = 0.04; // each older toast shrinks by this
const Y_STEP = 8;        // px each older toast peeks above the one in front

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<{ [key: number]: any }>({});

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current[id]);
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback<ToastFunction>(
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

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
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

export function useToast(): ToastFunction {
  const ctx = useContext(ToastContext);
  if (!ctx) return () => 0;
  return ctx;
}
