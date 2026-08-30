import { db } from "@/lib/db";

/**
 * Writing a Contact is the only thing that moves last_contact_at, so the list,
 * the follow-ups inbox and the reminder job can never disagree about it.
 * It also resolves any open reminder for that person.
 */
export async function logContact(
  personId: string,
  via: "logged" | "note" | "meeting" | "import" = "logged",
  happenedAt = new Date(),
) {
  await db.contact.create({ data: { personId, via, happenedAt } });

  const person = await db.person.findUnique({
    where: { id: personId },
    select: { lastContactAt: true },
  });
  if (!person) return;

  if (!person.lastContactAt || happenedAt > person.lastContactAt) {
    await db.person.update({
      where: { id: personId },
      data: { lastContactAt: happenedAt, snoozedUntil: null },
    });
  }

  await db.reminder.updateMany({
    where: { personId, resolvedBy: null },
    data: { resolvedBy: "contact" },
  });
}

/** Moving a person writes the timeline entry, so the ladder and the timeline agree. */
export async function setStatus(
  personId: string,
  toRank: number,
  authorId: string,
  { syncOut = true }: { syncOut?: boolean } = {},
) {
  const person = await db.person.findUnique({
    where: { id: personId },
    select: { statusRank: true, name: true },
  });
  if (!person || person.statusRank === toRank) return;

  await db.$transaction([
    db.person.update({
      where: { id: personId },
      data: { statusRank: toRank, statusChangedAt: new Date() },
    }),
    db.note.create({
      data: {
        personId,
        authorId,
        kind: "status_change",
        fromRank: person.statusRank,
        toRank,
        body: "",
      },
    }),
  ]);

  if (syncOut) {
    const { pushStatus } = await import("@/lib/airtable");
    await pushStatus(personId).catch(() => {});
  }
}
