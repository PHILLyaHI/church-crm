import { db } from "@/lib/db";
import {
  addDaysIso,
  birthdayOn,
  daysOverdue,
  fmtIso,
  isSunday,
  span,
  startOfDay,
  todayIso,
  turningAge,
  DAY,
} from "@/lib/dates";
import { birthdayEmail, reminderEmail, sendMail, type BirthdayNote, type Overdue } from "@/lib/mail";

type BirthdayRun = { name: string; email: string; birthdays: number; delivered: boolean };

/**
 * Birthdays, a week before and on the day. They run every day, Sundays too —
 * the date is the whole point. A Notification row per person per kind marks
 * each one sent, so running the job twice in a day never sends twice.
 */
export async function runBirthdays(
  now: Date,
  appUrl: string,
  fromName: string,
  fromAddress: string,
  /** Tests only: limit the pass to these leaders, so it never touches real people. */
  ownerIds?: string[],
) {
  const today = todayIso(now);
  const inAWeek = addDaysIso(today, 7);

  const people = await db.person.findMany({
    where: { archivedAt: null, birthday: { not: null }, ...(ownerIds ? { ownerId: { in: ownerIds } } : {}) },
    select: { id: true, name: true, birthday: true, owner: { select: { id: true, name: true, email: true } } },
  });

  const byLeader = new Map<string, { leader: { id: string; name: string; email: string }; items: BirthdayNote[] }>();
  const since = new Date(now.getTime() - 20 * 60 * 60 * 1000);

  for (const p of people) {
    const when = birthdayOn(p.birthday!, today) ? "today" : birthdayOn(p.birthday!, inAWeek) ? "week" : null;
    if (!when) continue;
    const kind = when === "today" ? "birthday_day" : "birthday_week";
    const href = `/people/${p.id}`;
    const already = await db.notification.findFirst({
      where: { userId: p.owner.id, kind, href, createdAt: { gt: since } },
      select: { id: true },
    });
    if (already) continue;

    const day = when === "today" ? today : inAWeek;
    const entry = byLeader.get(p.owner.id) ?? { leader: p.owner, items: [] };
    entry.items.push({
      personId: p.id,
      name: p.name,
      age: turningAge(p.birthday!, today),
      when,
      dayLabel: fmtIso(day, { weekday: "long", day: "numeric", month: "long" }),
    });
    byLeader.set(p.owner.id, entry);
  }

  const out: BirthdayRun[] = [];
  for (const { leader, items } of byLeader.values()) {
    items.sort((a, b) => (a.when === b.when ? a.name.localeCompare(b.name) : a.when === "today" ? -1 : 1));
    const mail = birthdayEmail({ items, appUrl });
    let delivered = false;
    try {
      delivered = (await sendMail({ to: leader.email, ...mail, fromName, fromAddress })).delivered;
    } catch (error) {
      console.error("[birthdays] mail failed", error);
    }
    await db.notification.createMany({
      data: items.map((b) => ({
        userId: leader.id,
        kind: b.when === "today" ? "birthday_day" : "birthday_week",
        body: b.when === "today" ? `${b.name}'s birthday is today.` : `${b.name}'s birthday is in a week.`,
        href: `/people/${b.personId}`,
      })),
    });
    out.push({ name: leader.name, email: leader.email, birthdays: items.length, delivered });
  }
  return out;
}

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
  birthdays?: BirthdayRun[];
};

export async function runFollowUps({ force = false } = {}): Promise<RunResult> {
  const defaults =
    (await db.reminderDefaults.findUnique({ where: { id: "singleton" } })) ??
    (await db.reminderDefaults.create({ data: { id: "singleton" } }));

  const now = new Date();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  // Birthdays first, and before the Sunday rule: a birthday cannot move.
  const birthdays = await runBirthdays(now, appUrl, defaults.fromName, defaults.fromAddress);

  if (defaults.skipSunday && isSunday(now) && !force) {
    return { ranAt: now.toISOString(), skipped: "Sunday — reminders are off by church setting.", leaders: [], birthdays };
  }
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
        followUpDates: true,
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
      churchName: defaults.fromName,
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

  return { ranAt: now.toISOString(), leaders: out, birthdays };
}
