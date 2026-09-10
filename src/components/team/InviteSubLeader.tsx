"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/Icons";
import { AlertGlyph } from "@/components/admin/Glyphs";
import { inviteSubLeader, type InviteState } from "@/app/team/actions";

/** A link with a button beside it that puts it on the clipboard. */
export function ShareLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="share">
      <input
        className="input share-field"
        value={link}
        readOnly
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Invitation link"
      />
      <button
        className="btn btn--ghost btn--sm"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            // No clipboard here; the field is selectable, so they can copy by hand.
          }
        }}
      >
        {copied ? (
          <>
            <Icon name="check" size="sm" /> Copied
          </>
        ) : (
          "Copy"
        )}
      </button>
    </span>
  );
}

/**
 * The form that builds a team. One field, because the address is all that is
 * needed: the link that comes back does the rest, whether or not they have an
 * account yet.
 */
export function InviteSubLeader() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteSubLeader, null);

  return (
    <>
      {state?.ok && (
        <div className="invite-done mb-4" role="status">
          <span className="invite-done-mark">
            <Icon name="check" />
          </span>
          <div className="invite-done-body">
            <b className="invite-done-title">
              {state.delivered ? "Invitation sent to " : "Invitation ready for "}
              {state.email}
            </b>
            <p className="invite-done-note">
              {state.delivered
                ? state.existing
                  ? "They already have an account. The link in the email signs them in and joins them to your team."
                  : "When they create an account from the link in the email, they will be on your team."
                : "Email is not set up on this server, so nothing was sent. Give them this link instead — it works for 14 days."}
            </p>
            <ShareLink link={state.link} />
          </div>
        </div>
      )}
      {state && !state.ok && (
        <div className="banner banner--warn mb-4">
          <AlertGlyph />
          <span>{state.error}</span>
        </div>
      )}

      {/* The action goes on the form untouched, so the form still posts without
          JavaScript. A sent invitation remounts it empty; a refused one keeps
          what was typed, so the address can be corrected rather than retyped. */}
      <form action={action} key={state?.ok ? `sent-${state.email}` : "new"}>
        <label className="field">
          <span className="label">Their email</span>
          <input
            className="input"
            type="email"
            name="email"
            autoComplete="off"
            placeholder="them@example.com"
            required
          />
        </label>
        <button className="btn btn--primary btn--wide" type="submit" data-pending={pending ? "true" : undefined}>
          <Icon name="team" size="sm" /> {pending ? "Sending…" : "Invite them to your team"}
        </button>
        <p className="hint mt-3">
          They will be able to see nothing of yours. You will be able to read their people, and the
          screen will always say the list is theirs.
        </p>
      </form>
    </>
  );
}
