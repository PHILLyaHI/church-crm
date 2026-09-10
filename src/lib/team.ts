import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Who reports to whom, and the invitations that build it.
 *
 * The tree has one rule that everything here protects: reading only ever goes
 * downward. A leader reads their direct reports' people and nothing else, so
 * nobody may end up above themselves, and an admin — who reads everything —
 * sits outside the tree altogether.
 */

export const INVITE_DAYS = 14;

/** 32 random bytes as hex. The token is the whole credential, so it is long. */
export const TOKEN_RE = /^[a-f0-9]{64}$/;

export function newToken() {
  return randomBytes(32).toString("hex");
}

export function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function inviteLink(token: string) {
  return `${appUrl()}/join/${token}`;
}

/** Would making `leaderId` the leader of `userId` put someone above themselves? */
export async function wouldLoop(userId: string, leaderId: string) {
  let cursor: string | null = leaderId;
  const walked = new Set<string>();
  while (cursor) {
    if (cursor === userId) return true;
    if (walked.has(cursor)) return true;
    walked.add(cursor);
    const up: { leaderId: string | null } | null = await db.user.findUnique({
      where: { id: cursor },
      select: { leaderId: true },
    });
    cursor = up?.leaderId ?? null;
  }
  return false;
}

export type OpenInvite = {
  id: string;
  token: string;
  email: string;
  inviterId: string;
  acceptedById: string | null;
  acceptedAt: Date | null;
  expiresAt: Date;
  inviter: { id: string; name: string };
};

export type InviteLookup =
  | { invite: OpenInvite; problem: null }
  | { invite: OpenInvite; problem: "used" | "expired" }
  | { invite: null; problem: "gone" };

/** The invitation behind a token, and whether it can still be accepted. */
export async function lookupInvite(token: string): Promise<InviteLookup> {
  if (!TOKEN_RE.test(token)) return { invite: null, problem: "gone" };
  const invite = await db.teamInvite.findUnique({
    where: { token },
    include: { inviter: { select: { id: true, name: true } } },
  });
  if (!invite) return { invite: null, problem: "gone" };
  if (invite.acceptedAt) return { invite, problem: "used" };
  if (invite.expiresAt < new Date()) return { invite, problem: "expired" };
  return { invite, problem: null };
}

export type JoinResult = { ok: true; leaderName: string } | { ok: false; error: string };

/**
 * Accepting is the one write: the user's leader becomes the inviter, and the
 * invitation is marked so it cannot be used twice. Every refusal names why.
 */
export async function acceptInvite(token: string, userId: string): Promise<JoinResult> {
  const found = await lookupInvite(token);
  if (found.problem === "gone") return { ok: false, error: "That invitation does not exist." };
  if (found.problem === "expired") {
    return { ok: false, error: `That invitation has expired. Ask ${found.invite.inviter.name} for a new one.` };
  }
  const { invite } = found;

  // Already theirs: say so rather than fail. Anyone else's: it is spent.
  if (found.problem === "used") {
    if (invite.acceptedById === userId) return { ok: true, leaderName: invite.inviter.name };
    return { ok: false, error: "That invitation has already been used." };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, leaderId: true },
  });
  if (!user) return { ok: false, error: "Sign in first." };
  if (user.id === invite.inviterId) {
    return { ok: false, error: "That is your own invitation. Send the link to them." };
  }
  if (user.role === "admin") {
    return { ok: false, error: "An admin already reads every list, so they cannot join a team." };
  }
  if (await wouldLoop(user.id, invite.inviterId)) {
    return {
      ok: false,
      error: `${invite.inviter.name} already reports to you, directly or further up. That would make a circle.`,
    };
  }

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { leaderId: invite.inviterId } }),
    db.teamInvite.update({
      where: { id: invite.id },
      data: { acceptedById: user.id, acceptedAt: new Date() },
    }),
  ]);
  return { ok: true, leaderName: invite.inviter.name };
}
