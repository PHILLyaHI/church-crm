"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icons";

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

/** Monday-first grid of the weeks that touch this month. */
function monthGrid(view: Date) {
  const firstOfMonth = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = new Date(firstOfMonth);
  // getDay() is Sunday-first; shift so Monday starts the row.
  start.setDate(1 - ((firstOfMonth.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function niceDate(iso: string, today: string) {
  if (iso === today) return "Today";
  const d = fromIso(iso);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toIso(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Half-hour steps, plus whatever odd minute the value already holds. */
function timeChoices(current: string) {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    out.push(`${pad(h)}:00`);
    out.push(`${pad(h)}:30`);
  }
  if (current && !out.includes(current)) out.push(current);
  return out.sort();
}

/**
 * A date and a time the design system actually owns. The native controls hand
 * their calendar and their spinner to the operating system, which draws both
 * in a font, a scale and a blue that belong to no design system; these keep
 * the popover on the page. Values still travel as ordinary form fields.
 */
export function DateTimePick({
  dateName,
  timeName,
  defaultDate,
  defaultTime,
}: {
  dateName: string;
  timeName: string;
  defaultDate: string;
  defaultTime: string;
}) {
  const today = defaultDate;
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [open, setOpen] = useState<"date" | "time" | null>(null);
  const [view, setView] = useState(() => fromIso(defaultDate));
  const [at, setAt] = useState({ top: 0, left: 0, width: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const dateBtn = useRef<HTMLButtonElement>(null);
  const timeBtn = useRef<HTMLButtonElement>(null);
  const timeList = useRef<HTMLDivElement>(null);

  /**
   * The popovers are portalled to the body: this control is often inside a
   * dialog whose own scroll container would otherwise clip the calendar. That
   * means positioning them by hand against the trigger.
   */
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = (open === "date" ? dateBtn : timeBtn).current;
    if (!trigger) return;
    const place = () => {
      const r = trigger.getBoundingClientRect();
      const width = open === "date" ? 292 : 132;
      const height = open === "date" ? 330 : 268;
      // Flip above the field when there is no room beneath it.
      const below = window.innerHeight - r.bottom;
      const top = below < height + 12 && r.top > height + 12 ? r.top - height - 6 : r.bottom + 6;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      setAt({ top, left, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrap.current?.contains(target)) return;
      if ((target as Element).closest?.(".when-pop")) return;
      setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open !== "time") return;
    timeList.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "center" });
  }, [open]);

  const grid = monthGrid(view);
  const inMonth = (d: Date) => d.getMonth() === view.getMonth();

  return (
    <div className="when when--custom" ref={wrap}>
      <input type="hidden" name={dateName} value={date} />
      <input type="hidden" name={timeName} value={time} />

      <button
        ref={dateBtn}
        type="button"
        className="when-field"
        aria-haspopup="dialog"
        aria-expanded={open === "date"}
        onClick={() => {
          setView(fromIso(date));
          setOpen(open === "date" ? null : "date");
        }}
      >
        <Icon name="calendar" size="sm" />
        <span>{niceDate(date, today)}</span>
      </button>

      <button
        ref={timeBtn}
        type="button"
        className="when-field"
        aria-haspopup="dialog"
        aria-expanded={open === "time"}
        onClick={() => setOpen(open === "time" ? null : "time")}
      >
        <Icon name="clock" size="sm" />
        <span className="num">{time}</span>
      </button>

      {open === "date" &&
        createPortal(
        <div
          className="when-pop"
          role="dialog"
          aria-label="Pick a date"
          style={{ top: at.top, left: at.left, width: at.width }}
        >
          <div className="cal-head">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous month"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            >
              <Icon name="chev" size="sm" className="flip" />
            </button>
            <b>
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </b>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next month"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
            >
              <Icon name="chev" size="sm" />
            </button>
          </div>
          <div className="cal-grid cal-dow">
            {DAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="cal-grid">
            {grid.map((d) => {
              const iso = toIso(d);
              const future = iso > today;
              return (
                <button
                  key={iso}
                  type="button"
                  className="cal-day"
                  data-out={!inMonth(d) ? "true" : undefined}
                  data-today={iso === today ? "true" : undefined}
                  aria-pressed={iso === date}
                  disabled={future}
                  onClick={() => {
                    setDate(iso);
                    setOpen(null);
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="btn btn--quiet btn--sm btn--wide mt-2"
            onClick={() => {
              setDate(today);
              setOpen(null);
            }}
          >
            Today
          </button>
        </div>,
        document.body,
      )}

      {open === "time" &&
        createPortal(
        <div
          className="when-pop when-pop--time"
          role="dialog"
          aria-label="Pick a time"
          ref={timeList}
          style={{ top: at.top, left: at.left, width: at.width }}
        >
          {timeChoices(time).map((t) => (
            <button
              key={t}
              type="button"
              className="time-option num"
              role="option"
              aria-selected={t === time}
              onClick={() => {
                setTime(t);
                setOpen(null);
              }}
            >
              {t}
              {t === time && <Icon name="check" size="sm" className="pick-tick" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
