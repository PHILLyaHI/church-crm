import { db } from "@/lib/db";
import { daysOverdue, isSunday, span, startOfDay, DAY } from "@/lib/dates";
import { reminderEmail, sendMail, type Overdue } from "@/lib/mail";

/**
 * The daily pass. A person is included when the interval has run out, they
 * are not snoozed, reminders are not paused, and (by default) it is not a
 * Sunday. One email per leader per day — the subject names the person whose
 * interval just tipped over, because that is the one most likely forgotten.
 *
 * Repeats every 7 days while still overdue, at most 3 times, then stops
 * emailing but stays in the Follow-ups inbox.
 */

export type RunResult = {
  ranAt: string;
  skipped?: string;
  leaders: { name: string; email: string; people: number; sent: boolean; delivered: boolean }[];
};

export async function runFollowUps({ force = false } = {}): Promise<RunResult> {
  const defaults =
    (await db.reminderDefaults.findUnique({ where: { id: "singleton" } })) ??
    (await db.reminderDefaults.create({ data: { id: "singleton" } }));

  const now = new Date();
  if (defaults.skipSunday && isSunday(now) && !force) {
    return { ranAt: now.toISOString(), skipped: "Sunday — reminders are off by church setting.", leaders: [] };
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const leaders = await db.user.findMany({
    where: { people: { some: { archivedAt: null } } },
    select: { id: true, name: true, email: true, sendHour: true },
  });

  const out: RunResult["leaders"] = [];

  for (const leader of leaders) {
    const people = await db.person.findMany({
      where: { ownerId: leader.id, archivedAt: null, remindersPaused: false },
      select: {
        id: true,
        name: true,
        intervalDays: true,
        lastContactAt: true,
        createdAt: true,
        snoozedUntil: true,
      },
    });

    const due: (Overdue & { intervalDays: number })[] = [];

    for (const p of people) {
      if (p.snoozedUntil && p.snoozedUntil > now) continue;
      const d = daysOverdue(p, now);
      if (d <= 0) continue;

      // Repeat weekly, three times, then stop emailing.
      const sent = await db.reminder.findMany({
        where: { personId: p.id, userId: leader.id, resolvedBy: null, sentAt: { not: null } },
        orderBy: { sentAt: "desc" },
      });
      if (sent.length >= defaults.maxAttempts) continue;
      const last = sent[0]?.sentAt;
      if (last && now.getTime() - last.getTime() < defaults.repeatDays * DAY) continue;

      due.push({ personId: p.id, name: p.name, days: d, intervalDays: p.intervalDays });
    }

    if (due.length === 0) {
      out.push({ name: leader.name, email: leader.email, people: 0, sent: false, delivered: false });
      continue;
    }

    // The tightest fit leads: the one that just tipped over.
    due.sort((a, b) => a.days - b.days);
    const [lead, ...others] = due;
    others.sort((a, b) => b.days - a.days);

    const mail = reminderEmail({
      leaderName: leader.name,
      lead,
      others,
      intervalWords: span(lead.intervalDays),
      appUrl,
      sendHour: leader.sendHour || defaults.sendHour,
      churchName: defaults.fromName === "Tend" ? "Fieldgate Church" : defaults.fromName,
    });

    const result = await sendMail({
      to: leader.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      fromName: defaults.fromName,
      fromAddress: defaults.fromAddress,
    });

    for (const d of due) {
      const priorCount = await db.reminder.count({
        where: { personId: d.personId, userId: leader.id, resolvedBy: null },
      });
      await db.reminder.create({
        data: {
          personId: d.personId,
          userId: leader.id,
          dueOn: startOfDay(now),
          sentAt: now,
          channel: "email",
          attempt: priorCount + 1,
        },
      });
    }

    await db.notification.create({
      data: {
        userId: leader.id,
        kind: "followup",
        body:
          due.length === 1
            ? `${lead.name} is ${span(lead.days)} past their interval.`
            : `${due.length} people are past their interval. ${lead.name} tipped over today.`,
        href: "/follow-ups",
      },
    });

    out.push({
      name: leader.name,
      email: leader.email,
      people: due.length,
      sent: true,
      delivered: result.delivered,
    });
  }

  return { ranAt: now.toISOString(), leaders: out };
}
