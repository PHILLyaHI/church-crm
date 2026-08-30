"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icons";
import { saveMyDetails } from "@/app/settings/actions";

type Me = { name: string; email: string; timezone: string; sendHour: number };

/** The one thing on Settings that writes: your own name, email, and the two
 *  small preferences (time zone, reminder hour) that decide when Tend speaks. */
export function EditMe({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const nameBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    nameBox.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        className="btn btn--ghost btn--sm"
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Icon name="pencil" size="sm" /> Edit
      </button>

      {open &&
        createPortal(
          <div
            className="scrim"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="modal" role="dialog" aria-modal="true" aria-label="Edit your details">
              <div className="modal-head">
                <h2>Your details</h2>
                <button className="icon-btn" type="button" aria-label="Close" onClick={() => setOpen(false)}>
                  <Icon name="x" size="sm" />
                </button>
              </div>
              <form
                className="modal-body"
                action={(data: FormData) => {
                  start(async () => {
                    const result = await saveMyDetails(null, data);
                    if (result.ok) setOpen(false);
                    else setError(result.error ?? "That could not be saved.");
                  });
                }}
              >
                <label className="field">
                  <span className="label">Name</span>
                  <input ref={nameBox} className="input" name="name" defaultValue={me.name} required />
                </label>
                <label className="field">
                  <span className="label">Email</span>
                  <input className="input" name="email" type="email" defaultValue={me.email} required />
                </label>
                <div className="grid-2">
                  <label className="field">
                    <span className="label">Time zone</span>
                    <input className="input" name="timezone" defaultValue={me.timezone} placeholder="Europe/London" />
                  </label>
                  <label className="field">
                    <span className="label">Reminder hour</span>
                    <input
                      className="input"
                      name="sendHour"
                      type="number"
                      min={0}
                      max={23}
                      defaultValue={me.sendHour}
                    />
                  </label>
                </div>
                {error && <p className="err mb-4">{error}</p>}
                <div className="row mt-4">
                  <button className="btn btn--quiet" type="button" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button className="btn btn--primary push" type="submit" data-pending={pending ? "true" : undefined}>
                    <Icon name="check" size="sm" /> {pending ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
