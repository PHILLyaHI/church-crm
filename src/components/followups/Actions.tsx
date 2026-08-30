"use client";

// What has to run on the client: the snooze menu, which opens, and resume,
// which posts. The follow-up form lives in FollowUp.tsx.

import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/Icons";
import { pauseAction, resumeAction, snoozeAction } from "@/app/follow-ups/actions";

const SNOOZE = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 28, label: "A month" },
];

function firstName(name: string) {
  return name.split(/\s+/)[0] ?? name;
}

export function SnoozeMenu({
  personId,
  name,
  up,
  icon,
}: {
  personId: string;
  name: string;
  /** In the thumb zone there is no room below the trigger. */
  up?: boolean;
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const run = (fn: () => Promise<void>) => {
    setOpen(false);
    start(async () => {
      await fn();
    });
  };

  return (
    <span className="menu-wrap" ref={wrap}>
      <button
        type="button"
        className={icon ? "btn btn--ghost btn--icon" : "btn btn--ghost btn--sm"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Snooze ${firstName(name)}`}
        data-pending={pending ? "true" : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {icon ? (
          <Icon name="clock" />
        ) : (
          <>
            <Icon name="clock" size="sm" /> Snooze
          </>
        )}
      </button>
      <span className={`menu${up ? " menu--up" : ""}${open ? " open" : ""}`} role="menu">
        {SNOOZE.map((s) => (
          <button
            key={s.days}
            type="button"
            role="menuitem"
            onClick={() => run(() => snoozeAction(personId, s.days))}
          >
            {s.label}
          </button>
        ))}
        <button type="button" role="menuitem" onClick={() => run(() => pauseAction(personId))}>
          Pause reminders
        </button>
      </span>
    </span>
  );
}

export function ResumeButton({ personId }: { personId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      data-pending={pending ? "true" : undefined}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          await resumeAction(personId);
        })
      }
    >
      Resume
    </button>
  );
}
