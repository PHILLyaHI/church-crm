"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icons";
import { recentSundays, sameDay } from "@/lib/dates";
import { markAttendance } from "@/app/people/[id]/actions";

type Att = { serviceDate: Date; state: string };

/**
 * The season band from the people list, with one difference: this week's box
 * is a button. The other fifteen stay history — too narrow to aim at
 * honestly — but this week is the one a leader actually needs to log without
 * leaving the list, so pressing it opens a two-choice dialog instead.
 */
export function SeasonBandPick({
  personId,
  name,
  attendance,
  weeks = 16,
  size,
}: {
  personId: string;
  name: string;
  attendance: Att[];
  weeks?: number;
  size?: "sm" | "lg";
}) {
  const sundays = recentSundays(weeks);
  const cls = size === "sm" ? "band band--sm" : size === "lg" ? "band band--lg" : "band";
  const last = sundays.length - 1;
  const lastSunday = sundays[last];
  const hit = attendance.find((a) => sameDay(new Date(a.serviceDate), lastSunday));

  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<string | null | undefined>(undefined);
  const [pending, start] = useTransition();
  const state = local === undefined ? (hit?.state ?? null) : local;

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
    data.set(
      "date",
      `${lastSunday.getFullYear()}-${String(lastSunday.getMonth() + 1).padStart(2, "0")}-${String(
        lastSunday.getDate(),
      ).padStart(2, "0")}`,
    );
    data.set("state", value);
    setOpen(false);
    start(async () => {
      setLocal(next);
      await markAttendance(data);
    });
  }

  const first = name.split(" ")[0] || name;

  return (
    <span className={cls} role="img" aria-label={`${attendance.filter((a) => a.state === "present").length} of the last ${weeks} Sundays`}>
      {sundays.slice(0, last).map((s) => {
        const h = attendance.find((a) => sameDay(new Date(a.serviceDate), s));
        const marks = [h?.state === "present" ? "on" : "", h?.state === "away" ? "away" : ""].filter(Boolean);
        return <i key={s.toISOString()} className={marks.join(" ")} />;
      })}
      <button
        type="button"
        className={["band-now", state === "present" ? "on" : "", state === "absent" ? "not-there" : "", pending ? "is-pending" : ""]
          .filter(Boolean)
          .join(" ")}
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
                <p className="t-quiet mb-4">Last Sunday, {lastSunday.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.</p>
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
              </div>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
