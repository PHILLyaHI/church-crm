"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logContact } from "@/lib/contact";
import { accessToOwner, requireViewer } from "@/lib/permissions";
import { MEETING_KINDS } from "@/lib/status";

/** Only the owner writes. Borrowed views never reach here. */
async function ownIt(personId: string) {
  const viewer = await requireViewer();
  const person = await db.person.findUnique({
    where: { id: personId },
    select: { ownerId: true },
  });
  if (!person) return null;
  const access = await accessToOwner(viewer, person.ownerId);
  if (!access.canWrite) return null;
  return viewer;
}

/**
 * The same log, with what actually happened attached. One Meeting is the whole
 * record — where, when, and what was said — so a contact is never written down
 * twice. logContact still owns lastContactAt.
 */
export async function logContactDetailed(formData: FormData) {
  const personId = String(formData.get("id") ?? "");
  if (!personId) return;
  const viewer = await ownIt(personId);
  if (!viewer) return;

  const kindRaw = String(formData.get("kind") ?? "coffee");
  const kind = MEETING_KINDS.some((k) => k.value === kindRaw) ? kindRaw : "coffee";
  const place = String(formData.get("place") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "");
  const timeRaw = String(formData.get("time") ?? "");

  // A date with no time is midday, so a time zone can never move the day.
  const stamp = dateRaw ? new Date(`${dateRaw}T${/^\d{2}:\d{2}/.test(timeRaw) ? timeRaw : "12:00"}:00`) : new Date();
  if (Number.isNaN(stamp.getTime())) return;
  // Nobody meets in the future; a mistyped year would freeze their reminders.
  const when = stamp > new Date() ? new Date() : stamp;

  await db.meeting.create({
    data: {
      personId,
      authorId: viewer.id,
      kind,
      happenedOn: when,
      place: place || null,
      body: body || null,
    },
  });

  await logContact(personId, "meeting", when);
  revalidatePath("/people");
  revalidatePath(`/people/${personId}`);
  revalidatePath("/follow-ups");
}
