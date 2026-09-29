"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icons";
import { markAttendance } from "@/app/people/[id]/actions";
import { cellClass, type BandCell } from "@/components/PersonBits";

/**
 * The season band from the people list, with one difference: this week's box
 * is a button. The other fifteen stay history — too narrow to aim at
 * honestly — but this week is the one a leader actually needs to log without
 * leaving the list, so pressing it opens a small dialog instead.
 *
 * It does no date arithmetic of its own. The cells, and which Sunday each one
 * is, arrive worked out by the server — the same server that saves the mark
 * and draws the profile — so the two pages can never disagree about a day.
 */
export function SeasonBandPick({
  personId,
  name,
  cells,
  lastLabel,
  size,
}: {
  personId: string;
  name: string;
  cells: BandCell[];
  /** "27 September": the most recent Sunday, as a person reads it. */
  lastLabel: string;
  size?: "sm" | "lg";
}) {
  const cls = size === "sm" ? "band band--sm" : size === "lg" ? "band band--lg" : "band";
  const last = cells[cells.length - 1];

  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<string | null | undefined>(undefined);
  const [pending, start] = useTransition();
  const state = local === undefined ? last.state : local;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function choose(value: "present" | "absent") {
    const next = state === value ? null : value;
    const data = new FormData();
    data.set("id", personId);
    data.set("date", last.iso);
    data.set("state", value);
    setOpen(false);
    start(async () => {
      setLocal(next);
      await markAttendance(data);
    });
  }

  const first = name.split(" ")[0] || name;
  const present = cells.filter((c, i) => (i === cells.length - 1 ? state : c.state) === "present").length;

  return (
    <span className={cls} role="img" aria-label={`${present} of the last ${cells.length} Sundays`}>
      {cells.slice(0, -1).map((c) => (
        <i key={c.iso} className={cellClass(c.state)} />
      ))}
      <button
        type="button"
        className={["band-now", cellClass(state), pending ? "is-pending" : ""].filter(Boolean).join(" ")}
        aria-label={`Mark ${first} for last Sunday`}
        aria-haspopup="dialog"
        onClick={(e) => {
          // The band sits inside a whole-row link on desktop; this button is
          // the one thing in it that must not fall through to that link.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        onMouseDown={(e) => e.stopPropagation()}
      />

      {open &&
        createPortal(
          <div
            className="scrim"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="modal modal--sm" role="dialog" aria-modal="true" aria-label={`Mark ${first} for last Sunday`}>
              <div className="modal-head">
                <h2>Was {first} here?</h2>
                <button className="icon-btn" type="button" aria-label="Close" onClick={() => setOpen(false)}>
                  <Icon name="x" size="sm" />
                </button>
              </div>
              <div className="modal-body">
                <p className="t-quiet mb-4">Last Sunday, {lastLabel}.</p>
                <div className="mark-choice">
                  <button
                    type="button"
                    className="mark-choice-btn is-present"
                    aria-pressed={state === "present"}
                    onClick={() => choose("present")}
                  >
                    <Icon name="check" />
                    Present
                  </button>
                  <button
                    type="button"
                    className="mark-choice-btn is-away"
                    aria-pressed={state === "absent"}
                    onClick={() => choose("absent")}
                  >
                    <Icon name="x" />
                    Not there
                  </button>
                </div>
                <p className="when-note mt-3">Press the answer it already has to clear it.</p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
