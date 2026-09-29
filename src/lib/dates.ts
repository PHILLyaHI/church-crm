// Overdue is derived, never stored: days_overdue = today - (last_contact_at + interval_days)

export const DAY = 86_400_000;

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

type DueInput = {
  lastContactAt: Date | null;
  intervalDays: number;
  createdAt: Date;
  /** Extra follow-up days. Optional so a query that omits it still works. */
  followUpDates?: Date[];
};

/**
 * When the next contact is due: the interval after the last one, unless a
 * scheduled follow-up date comes first. A scheduled date counts only while no
 * contact has been logged on or after it, so logging contact moves past it.
 */
export function dueDate(person: DueInput) {
  const from = person.lastContactAt ?? person.createdAt;
  let due = startOfDay(new Date(from.getTime() + person.intervalDays * DAY));
  const lastDay = startOfDay(from).getTime();
  for (const d of person.followUpDates ?? []) {
    const day = startOfDay(d);
    if (day.getTime() > lastDay && day < due) due = day;
  }
  return due;
}

/** The scheduled dates still waiting, soonest first. */
export function pendingFollowUps(person: DueInput) {
  const lastDay = startOfDay(person.lastContactAt ?? person.createdAt).getTime();
  return (person.followUpDates ?? [])
    .filter((d) => startOfDay(d).getTime() > lastDay)
    .sort((a, b) => a.getTime() - b.getTime());
}

/** Positive means overdue by that many days. Never contacted counts from creation. */
export function daysOverdue(person: DueInput, now = new Date()) {
  return Math.round((startOfDay(now).getTime() - dueDate(person).getTime()) / DAY);
}

export type Urgency = "over" | "soon" | "ok";

export function urgency(person: DueInput & {
  snoozedUntil: Date | null;
  remindersPaused: boolean;
}, now = new Date()): Urgency {
  if (person.remindersPaused) return "ok";
  if (person.snoozedUntil && person.snoozedUntil > now) return "ok";
  const d = daysOverdue(person, now);
  if (d > 0) return "over";
  if (d >= -3) return "soon";
  return "ok";
}

export function fmtDate(d: Date | null | undefined) {
  if (!d) return "Never";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDay(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** "6 days ago", "Today", "In 3 days" — plain words, no library. */
export function ago(d: Date | null | undefined, now = new Date()) {
  if (!d) return "Never";
  const days = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days === -1) return "Tomorrow";
  if (days > 0) return days < 14 ? `${days} days ago` : `${Math.floor(days / 7)} weeks ago`;
  return `In ${-days} days`;
}

/** Plain-word span used in reminder copy: "2 weeks", "9 days". */
export function span(days: number) {
  if (days % 7 === 0 && days >= 7) {
    const w = days / 7;
    return w === 1 ? "1 week" : `${w} weeks`;
  }
  return days === 1 ? "1 day" : `${days} days`;
}

// ---------------------------------------------------------- calendar days
//
// Attendance, birthdays and scheduled follow-ups are calendar days, not
// moments. They travel as "YYYY-MM-DD" strings and are compared as strings,
// so the server (UTC on Vercel) and a phone (Pacific) can never disagree
// about which day a thing belongs to. That disagreement was the bug: a
// Sunday saved at midnight UTC is 5pm Saturday in Pacific time.

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(s: string) {
  return ISO_RE.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime());
}

/** The calendar day a stored date belongs to, read in UTC. */
export function isoDay(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

/** Midnight UTC of a day — how attendance rows have always been stored. */
export function isoMidnight(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

/** Noon UTC of a day — the same calendar day in every server time zone. */
export function isoNoon(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

/** Where the church is. Decides which day "today" is, and so which Sunday is last. */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Los_Angeles";

/** Today's date where the church is. */
export function todayIso(now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** A day plus or minus n days, as a day. */
export function addDaysIso(iso: string, n: number) {
  const d = isoNoon(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}

/** The last n Sundays, oldest first, the most recent one included — the band's x axis. */
export function sundayIsos(n = 16, now = new Date()) {
  const today = isoNoon(todayIso(now));
  const back = today.getUTCDay(); // 0 on a Sunday
  const last = addDaysIso(isoDay(today), -back);
  return Array.from({ length: n }, (_, i) => addDaysIso(last, -(n - 1 - i) * 7));
}

/** Format a day for people, without the time zone moving it. */
export function fmtIso(iso: string, opts: Intl.DateTimeFormatOptions) {
  return isoNoon(iso).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}

// ------------------------------------------------------------- birthdays

/** A birthday saved without its year. 1904 is a leap year, so 29 Feb survives. */
export const UNKNOWN_YEAR = 1904;

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Does this birthday fall on this day? 29 Feb is kept on 28 Feb in other years. */
export function birthdayOn(birthday: Date, iso: string) {
  const md = isoDay(birthday).slice(5);
  const target = iso.slice(5);
  if (md === target) return true;
  return md === "02-29" && target === "02-28" && !isLeap(Number(iso.slice(0, 4)));
}

/** Days until the next birthday, 0 on the day itself. */
export function daysToBirthday(birthday: Date, today = todayIso()) {
  for (let i = 0; i <= 366; i++) {
    if (birthdayOn(birthday, addDaysIso(today, i))) return i;
  }
  return 366;
}

/**
 * A birthday from a form field, or null. A full day, or one whose year is
 * UNKNOWN_YEAR because only the month and day were given. Never in the future.
 */
export function parseBirthday(raw: unknown) {
  const s = String(raw ?? "").trim();
  if (!isIsoDay(s)) return null;
  const year = Number(s.slice(0, 4));
  if (year !== UNKNOWN_YEAR && (year < 1900 || s > todayIso())) return null;
  return isoNoon(s);
}

/** The age they turn on their next birthday, or null when the year is unknown. */
export function turningAge(birthday: Date, today = todayIso()) {
  const year = Number(isoDay(birthday).slice(0, 4));
  if (year === UNKNOWN_YEAR) return null;
  const next = addDaysIso(today, daysToBirthday(birthday, today));
  return Number(next.slice(0, 4)) - year;
}

export function isSunday(d = new Date()) {
  return d.getDay() === 0;
}

/** A moment `ms` in the past. Named so callers read as intent, not arithmetic. */
export function since(ms: number) {
  return new Date(Date.now() - ms);
}
