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
      <input className="input share-field" value={link} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Invitation link" />
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
        <Icon name="check" size="sm" style={{ opacity: copied ? 1 : 0, width: copied ? undefined : 0 }} />
        {copied ? "Copied" : "Copy"}
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
        <div className="banner banner--ok mb-4" style={{ flexWrap: "wrap" }}>
          <Icon name="check" />
          <span style={{ flex: 1, minWidth: 0 }}>
            {state.delivered ? (
              <>
                <b>Invitation sent to {state.email}.</b>{" "}
                {state.existing
                  ? "They already have an account: the link signs them in and joins them to your team."
                  : "When they create an account from the link, they will be on your team."}
              </>
            ) : (
              <>
                <b>Invitation ready for {state.email}.</b> Email is not set up on this server, so
                nothing was sent — give them this link instead. It works for 14 days.
              </>
            )}
          </span>
          <span style={{ width: "100%" }}>
            <ShareLink link={state.link} />
          </span>
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
