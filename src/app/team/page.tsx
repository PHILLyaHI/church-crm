import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Avatar, Icon } from "@/components/Icons";
import { Spread } from "@/components/PersonBits";
import { db } from "@/lib/db";
import { ago, urgency } from "@/lib/dates";
import { LADDER, roleLabel } from "@/lib/status";
import { directReportIds, requireViewer } from "@/lib/permissions";

export const metadata = { title: "Team — Tend" };

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function activeLine(lastSeenAt: Date | null) {
  if (!lastSeenAt) return "Not signed in yet";
  return `Active ${ago(lastSeenAt).toLowerCase()}`;
}

/** Higher leaders only. Each sub-leader is a bed on the plan. */
export default async function TeamPage() {
  const viewer = await requireViewer();
  const ids = await directReportIds(viewer.id);
  // A plain leader never learns this screen exists.
  if (ids.length === 0) redirect("/people");

  const rows = await db.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      role: true,
      lastSeenAt: true,
      people: {
        where: { archivedAt: null },
        select: {
          statusRank: true,
          lastContactAt: true,
          intervalDays: true,
          createdAt: true,
          snoozedUntil: true,
          remindersPaused: true,
        },
      },
    },
  });

  const leaders = rows
    .map((l) => ({
      id: l.id,
      name: l.name,
      role: l.role,
      lastSeenAt: l.lastSeenAt,
      count: l.people.length,
      overdue: l.people.filter((p) => urgency(p) === "over").length,
      spread: LADDER.map((s) => l.people.filter((p) => p.statusRank === s.rank).length),
    }))
    .sort((a, b) => b.overdue - a.overdue || a.name.localeCompare(b.name));

  const people = leaders.reduce((n, l) => n + l.count, 0);
  const overdue = leaders.reduce((n, l) => n + l.overdue, 0);

  return (
    <AppShell
      viewer={viewer}
      current="team"
      title={`${plural(leaders.length, "leader", "leaders")}, ${plural(people, "person", "people")}`}
      sub={
        overdue > 0 ? (
          <>
            <span className="over-n num">{overdue}</span> waiting across the team
          </>
        ) : (
          <>Everyone is on time.</>
        )
      }
    >
      <div className="plots only-desk">
        {leaders.map((l) => (
          <Link key={l.id} className="bed" href={`/team/${l.id}`}>
            <div className="bed-top">
              <Avatar name={l.name} onSheet />
              <span>
                <span className="bed-name">{l.name}</span>
                <br />
                <span className="bed-role">{roleLabel(l.role)}</span>
              </span>
            </div>
            <Spread counts={l.spread} />
            <div className="bed-figs">
              <span className="bed-fig">
                <span className="n">{l.count}</span>
                <span className="u">people</span>
              </span>
              <span className={l.overdue > 0 ? "bed-fig is-over" : "bed-fig"}>
                <span className="n">{l.overdue}</span>
                <span className="u">overdue</span>
              </span>
            </div>
            <div className="t-quiet mt-3">{activeLine(l.lastSeenAt)}</div>
          </Link>
        ))}
      </div>

      <div className="m-sheet only-mob">
        {leaders.map((l) => (
          <Link
            key={l.id}
            className="m-row"
            href={`/team/${l.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Avatar name={l.name} onSheet />
            <span className="grow">
              <b>{l.name}</b>
              <br />
              <span className="t-quiet num">
                {plural(l.count, "person", "people")} · {activeLine(l.lastSeenAt).toLowerCase()}
              </span>
            </span>
            <span className={l.overdue > 0 ? "flag flag--over" : "flag flag--ok"}>{l.overdue}</span>
            <Icon name="chev" size="sm" style={{ color: "var(--ink-3)" }} />
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
