"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/permissions";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SaveMeResult = { ok: boolean; error?: string };

/** The one form on Settings that writes: who you are, in your own words. */
export async function saveMyDetails(_prev: SaveMeResult | null, form: FormData): Promise<SaveMeResult> {
  const viewer = await requireViewer();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const timezone = String(form.get("timezone") ?? "").trim();
  const sendHour = Number(form.get("sendHour"));

  if (!name) return { ok: false, error: "Tell us your name." };
  if (!EMAIL.test(email)) return { ok: false, error: "That is not an email address." };
  if (!Number.isInteger(sendHour) || sendHour < 0 || sendHour > 23) {
    return { ok: false, error: "Reminder hour has to be between 0 and 23." };
  }

  if (email !== viewer.email) {
    const taken = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (taken) return { ok: false, error: "Someone already signs in with that email." };
  }

  await db.user.update({
    where: { id: viewer.id },
    data: { name, email, timezone: timezone || "Europe/London", sendHour },
  });

  revalidatePath("/settings");
  return { ok: true };
}
