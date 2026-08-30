import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { decode as decodeJwt, encode as encodeJwt } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

export class AuthMessage extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthMessage";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/sign-in" },
  /**
   * A cookie written under a previous AUTH_SECRET cannot be decrypted under the
   * current one. That is not an error worth throwing: it means "not signed in".
   * Swallowing it here turns a red JWTSessionError stack on every request into
   * an ordinary logged-out state, and the next sign-in overwrites the cookie.
   */
  jwt: {
    encode: encodeJwt,
    async decode(params) {
      try {
        return await decodeJwt(params);
      } catch {
        return null;
      }
    },
  },
  logger: {
    error(error) {
      // An unreadable session cookie is a logged-out visitor, not a fault: the
      // decode above already turned it into "no session", and the next sign-in
      // overwrites the cookie. Everything else still gets through.
      if (error?.name === "JWTSessionError") return;
      console.error("[auth]", error);
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const email = String(raw?.email ?? "").trim().toLowerCase();
        const password = String(raw?.password ?? "");
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          const failed = user.failedLogins + 1;
          await db.user.update({
            where: { id: user.id },
            data: {
              failedLogins: failed,
              lockedUntil:
                failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
            },
          });
          return null;
        }

        await db.user.update({
          where: { id: user.id },
          data: { failedLogins: 0, lockedUntil: null, lastSeenAt: new Date() },
        });

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user?.id) token.uid = user.id;
      // Role can change under a user; the rail redraws on their next load.
      if (token.uid && (trigger === "update" || !token.role || trigger === "signIn")) {
        const fresh = await db.user.findUnique({
          where: { id: token.uid as string },
          select: { role: true, name: true, onboardedAt: true },
        });
        token.role = fresh?.role ?? "leader";
        token.name = fresh?.name ?? token.name;
        token.onboarded = Boolean(fresh?.onboardedAt);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as string) ?? "leader";
        session.user.onboarded = Boolean(token.onboarded);
      }
      return session;
    },
  },
});

/** Why sign-in failed, in the words the field should show. */
export async function signInProblem(email: string) {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { lockedUntil: true },
  });
  if (!user) return { field: "email" as const, message: "No account with that email." };
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
    return {
      field: "password" as const,
      message: `Too many attempts. Try again in ${mins} minutes.`,
    };
  }
  return { field: "password" as const, message: "That password is wrong." };
}
