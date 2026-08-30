"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icons";
import { saveDetails } from "@/app/people/[id]/actions";

type Person = { id: string; name: string; phone: string | null; email: string | null };

/**
 * The three dots. One dialog holds everything that is not the person
 * themself: Follow up, Priority, Details, and — for whoever can write —
 * editing and the two ways to quiet a reminder. Read-only viewers get the
 * same dialog with the write actions left out, so borrowing a list never
 * costs you the ability to see them.
 */
export function PersonSettings({
  person,
  canWrite,
  paused,
  personAction,
  followUp,
  priority,
  details,
  reminderToggle,
}: {
  person: Person;
  canWrite: boolean;
  paused: boolean;
  personAction: (data: FormData) => Promise<void>;
  followUp: React.ReactNode;
  priority: React.ReactNode;
  details: React.ReactNode;
  reminderToggle?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const nameBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open && !editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (editing) setEditing(false);
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editing]);

  useEffect(() => {
    if (editing) nameBox.current?.focus();
  }, [editing]);

  return (
    <>
      <button
        className="icon-btn"
        aria-label="Settings"
        aria-expanded={open}
        type="button"
        onClick={() => setOpen(true)}
      >
        <Icon name="more" />
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
            <div className="modal" role="dialog" aria-modal="true" aria-label={`Settings for ${person.name}`}>
              <div className="modal-head">
                <h2>Settings</h2>
                <button className="icon-btn" type="button" aria-label="Close" onClick={() => setOpen(false)}>
                  <Icon name="x" size="sm" />
                </button>
              </div>
              <div className="modal-body">
                {canWrite && (
                  <div className="settings-actions mb-5">
                    <button
                      className="btn btn--ghost btn--sm"
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setEditing(true);
                      }}
                    >
                      <Icon name="pencil" size="sm" /> Edit their details
                    </button>
                    <form
                      className="settings-actions"
                      action={(data: FormData) => {
                        setOpen(false);
                        return personAction(data);
                      }}
                    >
                      <input type="hidden" name="id" value={person.id} />
                      <button className="btn btn--ghost btn--sm" name="do" value="snooze7">
                        Snooze a week
                      </button>
                      <button className="btn btn--ghost btn--sm" name="do" value="snooze28">
                        Snooze 4 weeks
                      </button>
                      <button className="btn btn--ghost btn--sm" name="do" value={paused ? "resume" : "pause"}>
                        {paused ? "Turn reminders back on" : "Pause reminders"}
                      </button>
                    </form>
                  </div>
                )}

                <section className="settings-sec">
                  <h3>Follow up</h3>
                  {followUp}
                  {reminderToggle}
                </section>

                <section className="settings-sec">
                  <h3>Priority</h3>
                  {priority}
                </section>

                <section className="settings-sec">
                  <h3>Details</h3>
                  {details}
                </section>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {editing &&
        createPortal(
          <div
            className="scrim"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditing(false);
            }}
          >
            <div className="modal" role="dialog" aria-modal="true" aria-label="Edit their details">
              <div className="modal-head">
                <h2>Their details</h2>
                <button
                  className="icon-btn"
                  type="button"
                  aria-label="Close"
                  onClick={() => setEditing(false)}
                >
                  <Icon name="x" size="sm" />
                </button>
              </div>
              <form
                className="modal-body"
                action={(data: FormData) => {
                  start(async () => {
                    await saveDetails(data);
                    setEditing(false);
                  });
                }}
              >
                <input type="hidden" name="id" value={person.id} />
                <label className="field">
                  <span className="label">Name</span>
                  <input
                    ref={nameBox}
                    className="input"
                    name="name"
                    defaultValue={person.name}
                    required
                  />
                </label>
                <label className="field">
                  <span className="label">Phone</span>
                  <input
                    className="input"
                    name="phone"
                    defaultValue={person.phone ?? ""}
                    placeholder="07700 900142"
                  />
                </label>
                <label className="field">
                  <span className="label">Email</span>
                  <input
                    className="input"
                    name="email"
                    type="email"
                    defaultValue={person.email ?? ""}
                    placeholder="them@example.com"
                  />
                </label>
                <div className="row mt-4">
                  <button className="btn btn--quiet" type="button" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn--primary push"
                    type="submit"
                    data-pending={pending ? "true" : undefined}
                  >
                    <Icon name="check" size="sm" /> {pending ? "Saving…" : "Save details"}
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
