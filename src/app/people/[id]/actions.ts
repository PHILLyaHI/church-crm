"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logContact, setStatus } from "@/lib/contact";
import { accessToOwner, requireViewer } from "@/lib/permissions";
import { DAY, isIsoDay, isoDay, isoMidnight, isoNoon, parseBirthday, startOfDay, todayIso } from "@/lib/dates";
import { MEETING_KINDS, PRIORITIES } from "@/lib/status";
import type { Viewer } from "@/lib/permissions";

/** Nobody writes to a borrowed record — not a higher leader, not an admin. */
async function ownIt(personId: string): Promise<Viewer | null> {
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

function done(personId: string) {
  revalidatePath(`/people/${personId}`);
  revalidatePath("/people");
}

/** The ladder. setStatus writes the timeline entry itself. */
export async function moveStatus(personId: string, rank: number) {
  const viewer = await ownIt(personId);
  if (!viewer) return;
  const to = Math.min(8, Math.max(1, Math.round(rank)));
  await setStatus(personId, to, viewer.id);
  done(personId);
}

export async function savePriority(formData: FormData) {
  const personId = String(formData.get("id") ?? "");
  const priority = String(formData.get("priority") ?? "");
  if (!PRIORITIES.some((p) => p.value === priority)) return;
  if (!(await ownIt(personId))) return;

  await db.person.update({ where: { id: personId }, data: { priority } });
  done(personId);
}

/**
 * The interval. A chip posts its own number; "Custom" posts the word custom
 * and the number typed beside it, so one form carries both.
 */
export async function saveInterval(formData: FormData) {
  const personId = String(formData.get("id") ?? "");
  const raw = String(formData.get("days") ?? "");
  const days = Math.round(Number(raw === "custom" ? formData.get("custom") : raw));
  if (!Number.isFinite(days) || days < 1 || days > 365) return;
  if (!(await ownIt(personId))) return;

  await db.person.update({ where: { id: personId }, data: { intervalDays: days } });
  done(personId);
}

/** One more follow-up day, on top of the interval. Today or later only. */
export async function addFollowUpDate(formData: FormData) {
  const personId = String(formData.get("id") ?? "");
  const iso = String(formData.get("date") ?? "");
  if (!isIsoDay(iso) || iso < todayIso()) return;
  if (!(await ownIt(personId))) return;

  const person = await db.person.findUnique({
    where: { id: personId },
    select: { followUpDates: true, lastContactAt: true, createdAt: true },
  });
  if (!person) return;

  // Keep only the dates still waiting, add this one once, soonest first.
  const lastDay = isoDay(person.lastContactAt ?? person.createdAt);
  const kept = person.followUpDates.map(isoDay).filter((d) => d > lastDay && d !== iso);
  const next = [...kept, iso].sort().slice(0, 24).map(isoNoon);

  await db.person.update({ where: { id: personId }, data: { followUpDates: next } });
  done(personId);
}

export async function removeFollowUpDate(formData: FormData) {
  const personId = String(formData.get("id") ?? "");
  const iso = String(formData.get("date") ?? "");
  if (!isIsoDay(iso)) return;
  if (!(await ownIt(personId))) return;

  const person = await db.person.findUnique({ where: { id: personId }, select: { followUpDates: true } });
  if (!person) return;
  await db.person.update({
    where: { id: personId },
    data: { followUpDates: person.followUpDates.filter((d) => isoDay(d) !== iso) },
  });
  done(personId);
}

/** A note may count as contact — the leader says so, we never guess. */
export async function addNote(formData: FormData) {
  const personId = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const counts = formData.get("contact") === "on";
  if (!body) return;

  const viewer = await ownIt(personId);
  if (!viewer) return;

  await db.note.create({
    data: { personId, authorId: viewer.id, kind: "note", body },
  });
  if (counts) await logContact(personId, "note");
  done(personId);
}

/** Adding a meeting is contact, always. */
export async function addMeeting(formData: FormData) {
  const personId = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "coffee");
  const raw = String(formData.get("date") ?? "");
  if (!MEETING_KINDS.some((k) => k.value === kind)) return;

  const viewer = await ownIt(personId);
  if (!viewer) return;

  const happenedOn = raw ? new Date(`${raw}T12:00:00`) : new Date();
  if (Number.isNaN(happenedOn.getTime())) return;

  await db.meeting.create({
    data: { personId, authorId: viewer.id, kind, happenedOn },
  });
  await logContact(personId, "meeting", happenedOn);
  done(personId);
}

export async function logContactHere(formData: FormData) {
  const personId = String(formData.get("id") ?? "");
  if (!personId) return;
  if (!(await ownIt(personId))) return;

  await logContact(personId, "logged");
  done(personId);
}

/** Snooze and pause both clear a ping without pretending contact happened. */
export async function personCommand(formData: FormData) {
  const personId = String(formData.get("id") ?? "");
  const cmd = String(formData.get("do") ?? "");
  if (!(await ownIt(personId))) return;

  if (cmd === "snooze7" || cmd === "snooze28") {
    const days = cmd === "snooze7" ? 7 : 28;
    await db.person.update({
      where: { id: personId },
      data: { snoozedUntil: new Date(startOfDay(new Date()).getTime() + days * DAY) },
    });
    await db.reminder.updateMany({
      where: { personId, resolvedBy: null },
      data: { resolvedBy: "snooze" },
    });
  } else if (cmd === "pause" || cmd === "resume") {
    await db.person.update({
      where: { id: personId },
      data: { remindersPaused: cmd === "pause" },
    });
    if (cmd === "pause") {
      await db.reminder.updateMany({
        where: { personId, resolvedBy: null },
        data: { resolvedBy: "pause" },
      });
    }
  } else {
    return;
  }
  done(personId);
}

export async function setRemindersPaused(personId: string, paused: boolean) {
  if (!(await ownIt(personId))) return;
  await db.person.update({ where: { id: personId }, data: { remindersPaused: paused } });
  if (paused) {
    await db.reminder.updateMany({
      where: { personId, resolvedBy: null },
      data: { resolvedBy: "pause" },
    });
  }
  done(personId);
}

// ------------------------------------------------------------------ details

/** Their name, the two ways to reach them, and their birthday. Nothing here is a status. */
export async function saveDetails(formData: FormData) {
  const personId = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!name || name.length > 120) return;
  if (!(await ownIt(personId))) return;

  await db.person.update({
    where: { id: personId },
    data: {
      name,
      phone: phone.slice(0, 40) || null,
      email: email.slice(0, 160) || null,
      birthday: parseBirthday(formData.get("birthday")),
    },
  });
  done(personId);
}

// --------------------------------------------------------------- attendance

const STATES = ["present", "away", "absent"] as const;

/**
 * One Sunday, one state. Pressing the state a person already has clears it
 * back to unknown, because "we never found out" is a real answer and the row
 * should be able to say it.
 */
export async function markAttendance(formData: FormData) {
  const personId = String(formData.get("id") ?? "");
  const raw = String(formData.get("date") ?? "");
  const state = String(formData.get("state") ?? "");
  if (!STATES.includes(state as (typeof STATES)[number])) return;
  if (!isIsoDay(raw)) return;
  if (!(await ownIt(personId))) return;

  // A Sunday is a calendar day: stored at midnight UTC, whatever time zone
  // this server or the phone that sent it happens to be in.
  const serviceDate = isoMidnight(raw);
  if (serviceDate.getUTCDay() !== 0) return;

  // Match the whole day, not one exact instant, so a row written at a
  // different hour of the same Sunday is still found rather than doubled.
  const sameSunday = {
    personId,
    serviceDate: { gte: serviceDate, lt: new Date(serviceDate.getTime() + DAY) },
  };
  const existing = await db.attendance.findMany({ where: sameSunday, select: { state: true } });

  if (existing.some((e) => e.state === state)) {
    await db.attendance.deleteMany({ where: sameSunday });
  } else {
    await db.$transaction([
      db.attendance.deleteMany({ where: sameSunday }),
      db.attendance.create({ data: { personId, serviceDate, state } }),
    ]);
  }
  done(personId);
}
