"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { DAY, startOfDay } from "@/lib/dates";
import { logContact } from "@/lib/contact";
import { requireViewer } from "@/lib/permissions";
import { MEETING_KINDS } from "@/lib/status";

/**
 * A reminder belongs to whoever carries the person. Nobody acts on someone
 * else's list from here — not a higher leader, not an admin.
 */
async function mine(personId: string) {
  const viewer = await requireViewer();
  const person = await db.person.findFirst({
    where: { id: personId, ownerId: viewer.id, archivedAt: null },
    select: { id: true },
  });
  if (!person) throw new Error("That person is not on your list.");
}

function refresh() {
  revalidatePath("/follow-ups");
  revalidatePath("/people");
}

const SNOOZE_DAYS = [7, 14, 28];

export async function snoozeAction(personId: string, days: number) {
  await mine(personId);
  if (!SNOOZE_DAYS.includes(days)) throw new Error("Snooze is 7, 14 or 28 days.");
  await db.person.update({
    where: { id: personId },
    data: { snoozedUntil: new Date(Date.now() + days * DAY), remindersPaused: false },
  });
  await db.reminder.updateMany({
    where: { personId, resolvedBy: null },
    data: { resolvedBy: "snooze" },
  });
  refresh();
}

/** Paused stops the email for good. The person stays on the list. */
export async function pauseAction(personId: string) {
  await mine(personId);
  await db.person.update({
    where: { id: personId },
    data: { remindersPaused: true, snoozedUntil: null },
  });
  await db.reminder.updateMany({
    where: { personId, resolvedBy: null },
    data: { resolvedBy: "pause" },
  });
  refresh();
}

export async function resumeAction(personId: string) {
  await mine(personId);
  await db.person.update({
    where: { id: personId },
    data: { remindersPaused: false, snoozedUntil: null },
  });
  refresh();
}

/**
 * A follow-up is the meeting itself, written down: when it happened, where,
 * and what was said. Recording one counts as contact, so the person leaves
 * this list and tomorrow's email by the same act that files the detail.
 */
export type FollowUpState = { error?: string; ok?: boolean };

export async function addFollowUpAction(
  _prev: FollowUpState,
  form: FormData,
): Promise<FollowUpState> {
  const personId = String(form.get("personId") ?? "");
  const when = String(form.get("when") ?? "");
  const kind = String(form.get("kind") ?? "coffee");
  const place = String(form.get("place") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();

  try {
    await mine(personId);
  } catch {
    return { error: "That person is not on your list." };
  }

  if (!when) return { error: "Say when you met." };
  const happenedOn = new Date(`${when}T12:00:00`);
  if (Number.isNaN(happenedOn.getTime())) return { error: "That date does not read." };
  // Compare days, not instants: the field carries a date, and noon today is
  // not "the future" just because it is currently morning.
  if (startOfDay(happenedOn) > startOfDay(new Date()))
    return { error: "That date is in the future." };

  if (!MEETING_KINDS.some((k) => k.value === kind)) return { error: "Pick how you met." };
  if (place.length > 120) return { error: "Keep the place under 120 characters." };
  if (body.length > 4000) return { error: "That note is too long to store." };

  await db.meeting.create({
    data: {
      personId,
      happenedOn,
      kind,
      place: place || null,
      body: body || null,
      authorId: (await requireViewer()).id,
    },
  });

  // Filing the detail is what clears the reminder — never a separate step.
  await logContact(personId, "meeting", happenedOn);
  refresh();
  return { ok: true };
}
