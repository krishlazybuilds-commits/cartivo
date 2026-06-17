"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function CustomSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [menuPos, setMenuPos] = useState({});
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setActive(idx >= 0 ? idx : 0);
    }
  }, [open, value, options]);

  function toggle() {
    if (!open) {
      const btn = triggerRef.current;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        setMenuPos({
          top: spaceBelow < 200 && spaceAbove > spaceBelow ? rect.top - 4 : rect.bottom + 4,
          left: rect.left,
          minWidth: rect.width,
        });
      }
    }
    setOpen((o) => !o);
  }

  // After render, clamp left so menu doesn't overflow right edge
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const menu = menuRef.current;
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth - 8) {
      menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
    }
    if (menuRect.left < 8) {
      menu.style.left = "8px";
    }
  }, [open]);

  function choose(opt) {
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) toggle();
        else setActive((a) => Math.min(options.length - 1, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) toggle();
        else setActive((a) => Math.max(0, a - 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) choose(options[active]);
        else toggle();
        break;
      case "Escape":
        setOpen(false);
        break;
      default:
        break;
    }
  }

  return (
    <div className={`custom-select${open ? " open" : ""}`} ref={ref}>
      <button
        type="button"
        className="custom-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        ref={triggerRef}
        onClick={toggle}
        onKeyDown={onKeyDown}
      >
        <span>{selected.label}</span>
        <svg
          className="custom-select-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && createPortal(
        <ul className="custom-select-menu" role="listbox" ref={menuRef} style={menuPos}>
          {options.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`custom-select-option${opt.value === value ? " selected" : ""}${i === active ? " active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(opt)}
            >
              <span>{opt.label}</span>
              {opt.value === value && (
                <svg
                  className="custom-select-check"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
}
