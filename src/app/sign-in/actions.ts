"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signInProblem } from "@/auth";
import { db } from "@/lib/db";
import { TOKEN_RE, acceptInvite } from "@/lib/team";

/** A team invitation riding along with the form, if it is shaped like one. */
function inviteToken(form: FormData) {
  const raw = String(form.get("invite") ?? "");
  return TOKEN_RE.test(raw) ? raw : null;
}

/** An error always belongs to the field that caused it. */
export type AuthState = { field: "name" | "email" | "password" | "confirm"; message: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function isDuplicate(error: unknown) {
  return (
    typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002"
  );
}

export async function signInAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email) return { field: "email", message: "Enter your email." };
  if (!password) return { field: "password", message: "Enter your password." };

  // With an invitation in hand they go back to it, signed in, and say yes
  // there. Without one the root decides: their people, or first run.
  const invite = inviteToken(form);

  try {
    await signIn("credentials", { email, password, redirectTo: invite ? `/join/${invite}` : "/" });
  } catch (error) {
    // A wrong password throws an AuthError; the redirect on success throws too,
    // and that one has to keep going.
    if (error instanceof AuthError) return signInProblem(email);
    throw error;
  }
  return null;
}

export async function registerAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (!name) return { field: "name", message: "Tell us your name." };
  if (!EMAIL.test(email)) return { field: "email", message: "That is not an email address." };
  if (password.length < MIN_PASSWORD) {
    return { field: "password", message: `At least ${MIN_PASSWORD} characters.` };
  }
  if (confirm !== password) {
    return { field: "confirm", message: "Those two passwords do not match." };
  }

  const taken = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) return { field: "email", message: "That email already has an account. Sign in instead." };

  // Somebody has to be able to reach Admin, and only an admin can promote
  // anyone — so on an empty database the first account through the door is
  // the admin. Every account after it is an ordinary leader.
  const first = (await db.user.count()) === 0;
  const invite = inviteToken(form);

  let userId: string;
  try {
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: first ? "admin" : "leader",
        // Nobody above them until a leader invites them or an admin says so.
        leaderId: null,
      },
      select: { id: true },
    });
    userId = user.id;
  } catch (error) {
    if (isDuplicate(error)) {
      return { field: "email", message: "That email already has an account. Sign in instead." };
    }
    throw error;
  }

  // An account made from an invitation link is on that team the moment it
  // exists. If the link has gone stale the join page says so; the account
  // is still made.
  if (invite) await acceptInvite(invite, userId);

  try {
    await signIn("credentials", { email, password, redirectTo: invite ? `/join/${invite}` : "/welcome" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { field: "password", message: "The account is made. Sign in to carry on." };
    }
    throw error;
  }
  return null;
}
