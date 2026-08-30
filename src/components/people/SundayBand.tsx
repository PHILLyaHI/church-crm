"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icons";
import { markAttendance } from "@/app/people/[id]/actions";

export type SundayCell = { iso: string; label: string; state: string | null; isLast: boolean };

const STATES = [
  { value: "present", label: "Present", icon: "check", cls: "is-present" },
  { value: "away", label: "Away", icon: "clock", cls: "is-away" },
  { value: "absent", label: "Not there", icon: "x", cls: "is-absent" },
] as const;

/**
 * The season band, answerable in place. Every Sunday in it is a button: press
 * the one you mean and set that Sunday, rather than reading a list of sixteen
 * rows to find it. Pressing the state a Sunday already has clears it, because
 * "we never found out" is a real answer the band should be able to show.
 */
export function SundayBand({
  personId,
  name,
  sundays,
  canWrite,
}: {
  personId: string;
  name: string;
  sundays: SundayCell[];
  canWrite: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, string | null>>({});
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const stateOf = (s: SundayCell) => (s.iso in local ? local[s.iso] : s.state);
  const active = sundays.find((s) => s.iso === open);
  const first = name.split(" ")[0] || name;

  function choose(iso: string, value: string) {
    const next = stateOf(sundays.find((s) => s.iso === iso)!) === value ? null : value;
    const data = new FormData();
    data.set("id", personId);
    data.set("date", iso);
    data.set("state", value);
    setOpen(null);
    start(async () => {
      setLocal((m) => ({ ...m, [iso]: next }));
      await markAttendance(data);
    });
  }

  return (
    <>
      <span
        className={pending ? "band band--lg is-pending" : "band band--lg"}
        role={canWrite ? "group" : "img"}
        aria-label={`${sundays.filter((s) => stateOf(s) === "present").length} of the last ${sundays.length} Sundays`}
      >
        {sundays.map((s) => {
          const st = stateOf(s);
          const cls = [
            st === "present" ? "on" : "",
            st === "away" ? "away" : "",
            st === "absent" ? "absent" : "",
            s.isLast ? "now" : "",
          ]
            .filter(Boolean)
            .join(" ");

          if (!canWrite) return <i key={s.iso} className={cls} />;

          return (
            <button
              key={s.iso}
              type="button"
              className={`band-cell ${cls}`}
              aria-label={`${s.label} — ${st ?? "not answered"}`}
              aria-haspopup="dialog"
              title={s.label}
              onClick={() => setOpen(s.iso)}
            />
          );
        })}
      </span>

      {active &&
        createPortal(
          <div
            className="scrim"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(null);
            }}
          >
            <div
              className="modal modal--sm"
              role="dialog"
              aria-modal="true"
              aria-label={`Was ${first} there on ${active.label}?`}
            >
              <div className="modal-head">
                <h2>Was {first} here?</h2>
                <button className="icon-btn" type="button" aria-label="Close" onClick={() => setOpen(null)}>
                  <Icon name="x" size="sm" />
                </button>
              </div>
              <div className="modal-body">
                <p className="t-quiet mb-4">
                  {active.label}
                  {active.isLast ? " · last Sunday" : ""}
                </p>
                <div className="mark-choice mark-choice--three">
                  {STATES.map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      className={`mark-choice-btn ${st.cls}`}
                      aria-pressed={stateOf(active) === st.value}
                      onClick={() => choose(active.iso, st.value)}
                    >
                      <Icon name={st.icon} />
                      {st.label}
                    </button>
                  ))}
                </div>
                <p className="when-note mt-3">Press the answer it already has to clear it.</p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
