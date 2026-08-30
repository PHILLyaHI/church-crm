import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PriorityMark, StatusChip } from "@/components/PersonBits";
import { DueFlag } from "@/components/PersonBits";
import { ResumeButton, SnoozeMenu } from "@/components/followups/Actions";
import { FollowUpPanel } from "@/components/followups/FollowUp";
import { db } from "@/lib/db";
import { DAY, daysOverdue, fmtDay, span, urgency } from "@/lib/dates";
import { requireViewer } from "@/lib/permissions";
import "@/styles/followups.css";

/**
 * Two columns and nothing else: who you have missed, and who falls due next.
 * The reminder email is not previewed here — it carries this same list, and
 * showing it twice made the screen argue with itself. It lives in Admin now.
 */

type Row = {
  id: string;
  name: string;
  statusRank: number;
  priority: string;
  intervalDays: number;
  lastContactAt: Date | null;
  createdAt: Date;
  snoozedUntil: Date | null;
  remindersPaused: boolean;
  notes: { body: string }[];
};

function dueOn(p: Row) {
  return new Date((p.lastContactAt ?? p.createdAt).getTime() + p.intervalDays * DAY);
}

function Card({ p, mode }: { p: Row; mode: "over" | "soon" | "held" }) {
  const overdue = mode === "over";
  const note = overdue ? p.notes[0]?.body : undefined;
  const past = daysOverdue(p) > 0;

  return (
    <article className={overdue ? "fu is-over" : "fu"}>
      <div className="fu-top">
        <Link className="fu-name" href={`/people/${p.id}`}>
          {p.name}
        </Link>
        <DueFlag person={p} />
      </div>

      <div className="fu-meta">
        <StatusChip rank={p.statusRank} short />
        {overdue && <PriorityMark priority={p.priority} />}
      </div>

      <p className="fu-when t-quiet">
        Last seen <span className="num">{p.lastContactAt ? fmtDay(p.lastContactAt) : "never"}</span>{" "}
        · every {span(p.intervalDays)} · {past ? "was due" : "due"}{" "}
        <span className="num">{fmtDay(dueOn(p))}</span>
      </p>

      {note && <p className="fu-note">“{note}”</p>}

      <div className="fu-act">
        {mode === "held" ? (
          <ResumeButton personId={p.id} />
        ) : (
          <>
            <FollowUpPanel personId={p.id} name={p.name} tone={overdue ? "primary" : "ghost"} />
            {overdue && <SnoozeMenu personId={p.id} name={p.name} />}
          </>
        )}
      </div>
    </article>
  );
}

function Column({
  head,
  count,
  hint,
  empty,
  children,
}: {
  head: string;
  count: number;
  hint?: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="fu-col">
      <header className="fu-colhead">
        <h2>{head}</h2>
        <span className="fu-count num">{count}</span>
        {hint && count > 1 && <span className="fu-hint">{hint}</span>}
      </header>
      {count === 0 ? <p className="fu-none">{empty}</p> : children}
    </section>
  );
}

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const viewer = await requireViewer();
  const { show } = await searchParams;
  const now = new Date();

  const people = await db.person.findMany({
    where: { ownerId: viewer.id, archivedAt: null },
    select: {
      id: true,
      name: true,
      statusRank: true,
      priority: true,
      intervalDays: true,
      lastContactAt: true,
      createdAt: true,
      snoozedUntil: true,
      remindersPaused: true,
      notes: {
        where: { kind: "note" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true },
      },
    },
  });

  const byWait = (a: Row, b: Row) => daysOverdue(b, now) - daysOverdue(a, now);
  const held = people.filter(
    (p) => p.remindersPaused || (p.snoozedUntil && p.snoozedUntil > now),
  ) as Row[];
  const live = people.filter((p) => !held.includes(p as Row)) as Row[];
  const over = live.filter((p) => urgency(p, now) === "over").sort(byWait);
  const soon = live.filter((p) => urgency(p, now) === "soon").sort(byWait);

  const title =
    over.length === 0
      ? "Nobody is waiting"
      : over.length === 1
        ? "1 person is waiting"
        : `${over.length} people are waiting`;

  // The snoozed list is a detour, not a third column.
  if (show === "snoozed") {
    return (
      <AppShell
        viewer={viewer}
        current="followups"
        title="Snoozed"
        crumb={
          <>
            <Link href="/follow-ups">Follow-ups</Link> <b>Snoozed</b>
          </>
        }
      >
        <div className="fu-single">
          {held.length === 0 ? (
            <p className="fu-none">Nothing is held. Snoozing puts a reminder off for a while.</p>
          ) : (
            held.sort(byWait).map((p) => <Card key={p.id} p={p} mode="held" />)
          )}
          <p className="fu-back">
            <Link href="/follow-ups">Back to follow-ups</Link>
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      viewer={viewer}
      current="followups"
      title={title}
      crumb={<b>Follow-ups</b>}
    >
      <div className="fu-cols">
        <Column
          head="Missed"
          count={over.length}
          hint="Longest wait first"
          empty="Everyone is inside the interval you set for them."
        >
          {over.map((p) => (
            <Card key={p.id} p={p} mode="over" />
          ))}
        </Column>

        <Column
          head="Due this week"
          count={soon.length}
          empty="Nobody reaches the end of their interval in the next few days."
        >
          {soon.map((p) => (
            <Card key={p.id} p={p} mode="soon" />
          ))}
        </Column>
      </div>

      {held.length > 0 && (
        <p className="fu-held">
          <Link href="/follow-ups?show=snoozed">
            <span className="num">{held.length}</span> snoozed
          </Link>
        </p>
      )}
    </AppShell>
  );
}
