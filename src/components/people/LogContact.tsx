"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { DateTimePick } from "@/components/DateTimePick";
import { Icon } from "@/components/Icons";
import { MEETING_KINDS } from "@/lib/status";
import { logContactDetailed } from "@/app/people/actions";

/** Now, as the two values the native date and time inputs want. */
function nowParts() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

/**
 * The row action. One choice is the whole requirement — what it was. Date and
 * time are already filled in, and everything else is there if it is worth
 * saying. The dialog is portalled: the cell it is triggered from fades out
 * when the row loses hover, and opacity takes its children with it.
 */
export function LogContact({
  personId,
  name,
  className,
  children,
  onSaved,
}: {
  personId: string;
  name: string;
  className: string;
  children?: React.ReactNode;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("coffee");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  const parts = nowParts();

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 3200);
    return () => clearTimeout(t);
  }, [saved]);

  const firstName = name.split(/\s+/)[0] || name;

  return (
    <>
      <button
        className={className}
        type="button"
        onClick={(e) => {
          // The whole row is a link to the person; this is not that.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {children ?? "Log contact"}
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
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Log contact with ${name}`}
            >
              <div className="modal-head">
                <h2>Log contact with {firstName}</h2>
                <button
                  className="icon-btn"
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                >
                  <Icon name="x" size="sm" />
                </button>
              </div>

              <form
                className="modal-body"
                action={(data: FormData) => {
                  start(async () => {
                    await logContactDetailed(data);
                    setOpen(false);
                    setSaved(firstName);
                    onSaved?.();
                  });
                }}
              >
                <input type="hidden" name="id" value={personId} />
                <input type="hidden" name="kind" value={kind} />

                <div className="field">
                  <span className="label" style={{ display: "block", marginBottom: 6 }}>
                    What was it?
                  </span>
                  <div className="kindpick">
                    {MEETING_KINDS.map((k, i) => (
                      <button
                        key={k.value}
                        ref={i === 0 ? first : undefined}
                        type="button"
                        aria-pressed={kind === k.value}
                        onClick={() => setKind(k.value)}
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>
                  <p className="when-note">This is the only thing this needs. The rest is yours to skip.</p>
                </div>

                <div className="field">
                  <span className="label" style={{ display: "block", marginBottom: 6 }}>
                    When
                  </span>
                  <DateTimePick
                    dateName="date"
                    timeName="time"
                    defaultDate={parts.date}
                    defaultTime={parts.time}
                  />
                </div>

                <label className="field">
                  <span className="label">Where</span>
                  <input className="input" name="place" placeholder="Their kitchen, the café…" />
                </label>

                <label className="field">
                  <span className="label">What happened</span>
                  <textarea
                    className="input"
                    name="body"
                    rows={4}
                    placeholder="What you talked about, anything to follow up on."
                  />
                </label>

                <div className="row mt-4">
                  <button className="btn btn--quiet" type="button" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn--primary push"
                    type="submit"
                    data-pending={pending ? "true" : undefined}
                  >
                    <Icon name="check" size="sm" /> {pending ? "Saving…" : "Save contact"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {saved &&
        createPortal(
          <div className="toast" role="status">
            <Icon name="check" size="sm" /> Contact with {saved} saved.
          </div>,
          document.body,
        )}
    </>
  );
}
