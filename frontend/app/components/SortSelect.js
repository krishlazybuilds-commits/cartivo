"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Accessible custom dropdown. Replaces a native <select> so the open menu can
 * be fully styled (native option lists are rendered by the OS and can't be).
 * Supports keyboard navigation, click-outside, and Escape to close.
 */
export default function SortSelect({ value, options, onChange, label = "Sort by" }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  // Close when clicking outside.
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Sync highlighted option to the current value when opening.
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setActive(idx >= 0 ? idx : 0);
    }
  }, [open, value, options]);

  function choose(opt) {
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) setOpen(true);
        else setActive((a) => Math.min(options.length - 1, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) setOpen(true);
        else setActive((a) => Math.max(0, a - 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) choose(options[active]);
        else setOpen(true);
        break;
      case "Escape":
        setOpen(false);
        break;
      default:
        break;
    }
  }

  return (
    <div className={`sort-select${open ? " open" : ""}`} ref={ref}>
      <span className="sort-select-label">{label}</span>
      <div className="sort-select-control">
        <button
          type="button"
          className="sort-select-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onKeyDown}
        >
          <span>{selected.label}</span>
          <svg
            className="sort-select-chevron"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open && (
          <ul className="sort-select-menu" role="listbox" aria-label={label}>
            {options.map((opt, i) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={`sort-select-option${opt.value === value ? " selected" : ""}${
                  i === active ? " active" : ""
                }`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(opt)}
              >
                <span>{opt.label}</span>
                {opt.value === value && (
                  <svg
                    className="sort-select-check"
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
          </ul>
        )}
      </div>
    </div>
  );
}
