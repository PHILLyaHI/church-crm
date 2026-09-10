"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { inviteEmail, mailConfigured, sendMail } from "@/lib/mail";
import { requireViewer } from "@/lib/permissions";
import { INVITE_DAYS, TOKEN_RE, acceptInvite, inviteLink, newToken, wouldLoop } from "@/lib/team";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY = 86_400_000;

export type InviteState =
  | {
      ok: true;
      email: string;
      link: string;
      /** The email went out. When false, the link on screen is the invitation. */
      delivered: boolean;
      /** They already have an account; the link signs them in and joins them. */
      existing: boolean;
    }
  | { ok: false; error: string }
  | null;

/**
 * Any leader can ask anyone to report to them. If the address already has an
 * account the same link signs them in and joins them; if not, creating an
 * account from the link joins them the moment it is made.
 */
export async function inviteSubLeader(_prev: InviteState, form: FormData): Promise<InviteState> {
  const viewer = await requireViewer();
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL.test(email)) return { ok: false, error: "That is not an email address." };
  if (email === viewer.email.toLowerCase()) {
    return { ok: false, error: "That is you. Invite someone else." };
  }

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, role: true, leaderId: true },
  });
  if (existing) {
    if (existing.leaderId === viewer.id) {
      return { ok: false, error: `${existing.name} is already on your team.` };
    }
    if (existing.role === "admin") {
      return { ok: false, error: `${existing.name} is an admin. Admins read every list, so they cannot join a team.` };
    }
    if (await wouldLoop(existing.id, viewer.id)) {
      return {
        ok: false,
        error: `${existing.name} is above you, directly or further up. That would make a circle, and reading only goes downward.`,
      };
    }
  }

  // One open invitation per address per leader. Sending again extends it.
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * DAY);
  const open = await db.teamInvite.findFirst({
    where: { inviterId: viewer.id, email, acceptedAt: null, expiresAt: { gt: now } },
  });
  const invite = open
    ? await db.teamInvite.update({ where: { id: open.id }, data: { expiresAt } })
    : await db.teamInvite.create({
        data: { token: newToken(), email, inviterId: viewer.id, expiresAt },
      });

  const link = inviteLink(invite.token);
  const mail = inviteEmail({ inviterName: viewer.name, link, days: INVITE_DAYS });
  let delivered = false;
  if (mailConfigured()) {
    try {
      delivered = (await sendMail({ to: email, ...mail })).delivered;
    } catch (error) {
      console.error("[invite] mail failed", error);
    }
  }

  revalidatePath("/team");
  return { ok: true, email, link, delivered, existing: Boolean(existing) };
}

/** Take back an invitation that has not been used. Only its sender can. */
export async function revokeInvite(form: FormData): Promise<void> {
  const viewer = await requireViewer();
  const id = String(form.get("id") ?? "");
  if (!id) return;
  await db.teamInvite.deleteMany({ where: { id, inviterId: viewer.id, acceptedAt: null } });
  revalidatePath("/team");
}

/** The button on the join page, for someone already signed in. */
export async function acceptInviteAction(form: FormData): Promise<void> {
  const viewer = await requireViewer();
  const token = String(form.get("token") ?? "");
  if (!TOKEN_RE.test(token)) redirect("/people");
  const result = await acceptInvite(token, viewer.id);
  revalidatePath("/team");
  revalidatePath("/people");
  // Either way the join page has the words for what happened.
  redirect(result.ok ? `/join/${token}` : `/join/${token}?err=${encodeURIComponent(result.error)}`);
}
