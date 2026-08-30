// Overdue is derived, never stored: days_overdue = today - (last_contact_at + interval_days)

export const DAY = 86_400_000;

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Positive means overdue by that many days. Never contacted counts from creation. */
export function daysOverdue(person: {
  lastContactAt: Date | null;
  intervalDays: number;
  createdAt: Date;
}, now = new Date()) {
  const from = person.lastContactAt ?? person.createdAt;
  const due = startOfDay(new Date(from.getTime() + person.intervalDays * DAY));
  return Math.round((startOfDay(now).getTime() - due.getTime()) / DAY);
}

export type Urgency = "over" | "soon" | "ok";

export function urgency(person: {
  lastContactAt: Date | null;
  intervalDays: number;
  createdAt: Date;
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

/** The last n Sundays, oldest first — the season band's x axis. */
export function recentSundays(n = 16, now = new Date()) {
  const out: Date[] = [];
  const d = startOfDay(now);
  d.setDate(d.getDate() - d.getDay()); // back to this week's Sunday
  for (let i = n - 1; i >= 0; i--) {
    const s = new Date(d);
    s.setDate(d.getDate() - i * 7);
    out.push(s);
  }
  return out;
}

export function sameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function isSunday(d = new Date()) {
  return d.getDay() === 0;
}

/** A moment `ms` in the past. Named so callers read as intent, not arithmetic. */
export function since(ms: number) {
  return new Date(Date.now() - ms);
}
