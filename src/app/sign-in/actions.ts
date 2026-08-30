"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signInProblem } from "@/auth";
import { db } from "@/lib/db";

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

  try {
    // The root decides where they land: their people, or first run.
    await signIn("credentials", { email, password, redirectTo: "/" });
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

  try {
    await db.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: "leader",
        // Nobody above them until an admin says so.
        leaderId: null,
      },
    });
  } catch (error) {
    if (isDuplicate(error)) {
      return { field: "email", message: "That email already has an account. Sign in instead." };
    }
    throw error;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/welcome" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { field: "password", message: "The account is made. Sign in to carry on." };
    }
    throw error;
  }
  return null;
}
