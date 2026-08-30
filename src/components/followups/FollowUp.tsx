"use client";

// Recording the meeting is the way out of this list. The form opens in place
// under the person it belongs to — nothing here needs a modal's protected
// focus, and taking over the screen would hide the queue you are working.

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { addFollowUpAction, type FollowUpState } from "@/app/follow-ups/actions";
import { MEETING_KINDS } from "@/lib/status";

function firstName(name: string) {
  return name.split(/\s+/)[0] ?? name;
}

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function FollowUpPanel({
  personId,
  name,
  tone = "primary",
}: {
  personId: string;
  name: string;
  /** Overdue rows lead with it; due-soon rows keep it quiet. */
  tone?: "primary" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [state, submit, pending] = useActionState<FollowUpState, FormData>(addFollowUpAction, {});
  const panel = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    firstField.current?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  // Saving moves their last-contact date, so the card normally leaves the
  // column and takes this with it. If it lingers, say what happened rather
  // than leaving a filled-in form standing open.
  if (state.ok) {
    return (
      <span className="fu-saved">
        <Icon name="check" size="sm" /> Saved
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className={tone === "primary" ? "btn btn--primary btn--sm" : "btn btn--ghost btn--sm"}
        aria-expanded={false}
        onClick={() => setOpen(true)}
      >
        <Icon name="plus" size="sm" /> Add follow-up
      </button>
    );
  }

  return (
    <div className="fup" ref={panel}>
      <form action={submit} className="fup-form">
        <input type="hidden" name="personId" value={personId} />

        <div className="fup-head">
          <span className="label">Follow-up with {firstName(name)}</span>
          <button
            type="button"
            className="btn btn--quiet btn--sm fup-close"
            onClick={() => setOpen(false)}
            aria-label="Close without saving"
          >
            <Icon name="x" size="sm" />
          </button>
        </div>

        <div className="fup-grid">
          <label className="fup-field" htmlFor={`${id}-when`}>
            <span className="label">When</span>
            <input
              ref={firstField}
              id={`${id}-when`}
              name="when"
              type="date"
              className="input"
              defaultValue={today()}
              max={today()}
              required
            />
          </label>

          <label className="fup-field" htmlFor={`${id}-kind`}>
            <span className="label">How</span>
            <select id={`${id}-kind`} name="kind" className="input" defaultValue="coffee">
              {MEETING_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          <label className="fup-field fup-field--wide" htmlFor={`${id}-place`}>
            <span className="label">Where</span>
            <input
              id={`${id}-place`}
              name="place"
              className="input"
              placeholder="His kitchen, the Tuesday group, the phone"
              maxLength={120}
            />
          </label>
        </div>

        <label className="fup-field" htmlFor={`${id}-body`}>
          <span className="label">What you talked about</span>
          <textarea
            id={`${id}-body`}
            name="body"
            className="input"
            rows={3}
            maxLength={4000}
            placeholder="What moved, what he asked, what to pick up next time."
          />
        </label>

        {state.error && (
          <p className="err" role="alert">
            <Icon name="x" size="sm" /> {state.error}
          </p>
        )}

        <div className="fup-foot">
          <span className="t-quiet">Saving this counts as contact.</span>
          <button
            type="submit"
            className="btn btn--primary btn--sm"
            data-pending={pending ? "true" : undefined}
            aria-busy={pending}
          >
            {pending ? "Saving" : "Save follow-up"}
          </button>
        </div>
      </form>
    </div>
  );
}
