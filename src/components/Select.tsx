"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/Icons";

export type Choice = { value: string; label: string; note?: string };

/**
 * The system's own dropdown. A native <select> hands the menu to the OS, which
 * draws it in a font, a scale and a blue we do not own; this keeps the menu on
 * the page. It is a real listbox: arrows move, Home/End jump, typing seeks,
 * Enter commits, Escape closes, and focus returns to the trigger.
 */
export function Select({
  value,
  choices,
  onChange,
  label,
  width,
  block,
  align = "left",
}: {
  value: string;
  choices: Choice[];
  onChange: (value: string) => void;
  label: string;
  width?: number;
  /** Fill the column it sits in, rather than sizing to a fixed width. */
  block?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const seek = useRef({ term: "", at: 0 });
  const id = useId();

  const index = Math.max(0, choices.findIndex((c) => c.value === value));
  const current = choices[index] ?? choices[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  /** The list always opens on what is selected now. */
  function show() {
    setActive(index);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    wrap.current?.querySelector("button")?.focus();
  }

  function commit(i: number) {
    const picked = choices[i];
    if (picked) onChange(picked.value);
    close();
  }

  function onKey(e: React.KeyboardEvent) {
    const last = choices.length - 1;
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      show();
      return;
    }
    if (!open) return;

    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a >= last ? 0 : a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? last : a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(last);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(active);
    } else if (e.key.length === 1) {
      // Type-ahead: keystrokes within a second build one search term. The
      // event's own clock is used, so nothing impure is read while rendering.
      const now = e.timeStamp;
      seek.current.term = now - seek.current.at > 1000 ? e.key : seek.current.term + e.key;
      seek.current.at = now;
      const term = seek.current.term.toLowerCase();
      const hit = choices.findIndex((c) => c.label.toLowerCase().startsWith(term));
      if (hit >= 0) setActive(hit);
    }
  }

  return (
    <div
      className={[open ? "pick is-open" : "pick", block ? "pick--block" : ""].filter(Boolean).join(" ")}
      ref={wrap}
      style={width && !block ? { width } : undefined}
      onKeyDown={onKey}
    >
      <button
        type="button"
        className="pick-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <span className="pick-value">{current?.label}</span>
        <Icon name="chev" size="sm" className="pick-chev" />
      </button>

      {open && (
        <div
          className={align === "right" ? "pick-menu is-right" : "pick-menu"}
          role="listbox"
          id={id}
          aria-label={label}
          ref={list}
          tabIndex={-1}
        >
          {choices.map((c, i) => (
            <button
              key={c.value}
              type="button"
              role="option"
              aria-selected={c.value === value}
              data-active={i === active ? "true" : undefined}
              className="pick-option"
              onMouseEnter={() => setActive(i)}
              onClick={() => commit(i)}
            >
              <span className="pick-option-text">
                <span className="pick-option-label">{c.label}</span>
                {c.note && <span className="pick-option-note">{c.note}</span>}
              </span>
              {c.value === value && <Icon name="check" size="sm" className="pick-tick" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
