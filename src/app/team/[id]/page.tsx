import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Avatar, Icon } from "@/components/Icons";
import { DueFlag, PriorityMark, SeasonBand, StatusChip } from "@/components/PersonBits";
import { db } from "@/lib/db";
import { daysOverdue, fmtDate, recentSundays, span, urgency } from "@/lib/dates";
import { accessToOwner, requireViewer } from "@/lib/permissions";

const WEEKS = 16;

/** Ben Castellanos’ → Ruth’s. */
function poss(name: string) {
  return name.endsWith("s") ? `${name}’` : `${name}’s`;
}

export default async function SubLeaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  // Their own list is not a borrowed one.
  if (id === viewer.id) redirect("/people");

  const access = await accessToOwner(viewer, id);
  if (!access.canRead) notFound();

  const owner = await db.user.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!owner) notFound();

  const people = await db.person.findMany({
    where: { ownerId: id, archivedAt: null },
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
      attendance: {
        where: { serviceDate: { gte: recentSundays(WEEKS)[0] } },
        select: { serviceDate: true, state: true },
      },
    },
  });

  // Longest wait first — the only order that matters to a leader reading down.
  const sorted = [...people].sort((a, b) => daysOverdue(b) - daysOverdue(a));
  const overdue = people.filter((p) => urgency(p) === "over").length;
  const first = owner.name.split(/\s+/)[0];

  const noEditing = (
    <span className="flag flag--read">
      <Icon name="lock" size="sm" /> No editing
    </span>
  );

  return (
    <AppShell
      viewer={viewer}
      current="team"
      title={owner.name}
      sub={
        <>
          <span className="num">{people.length}</span> people
          {overdue > 0 && (
            <>
              {" · "}
              <span className="over-n num">{overdue} overdue</span>
            </>
          )}
        </>
      }
      crumb={
        <>
          <Link href="/team">Team</Link>
          <Icon name="chev" size="sm" style={{ stroke: "var(--rule-2)" }} />
          <b>{owner.name}</b>
        </>
      }
      back={{ href: "/team", label: "Team" }}
    >
      <div className="banner banner--read mb-4 only-desk">
        <Icon name="eye" />
        <span>
          <b>Read-only.</b> These are {poss(owner.name)} people. You can read them; you cannot
          change them, and {first} cannot see your list or anyone else’s.
        </span>
        <span className="right">
          <Link className="btn btn--ghost btn--sm" href="/team">
            Back to the team
          </Link>
        </span>
      </div>

      <div className="banner banner--read mb-4 only-mob">
        <Icon name="eye" />
        <span>
          <b>Read-only.</b> {poss(owner.name)} people. {first} can’t see yours.
        </span>
      </div>

      <section className="sheet ro-mask only-desk">
        <div className="sheet-head">
          <h2>
            {owner.name} · {people.length} people
          </h2>
          <span className="sheet-note">Sorted by how long they have waited</span>
          <span className="right">{noEditing}</span>
        </div>

        {sorted.length === 0 ? (
          <div className="empty">
            <div className="empty-plot">
              <i />
              <i />
              <i />
              <i />
            </div>
            <h3>No one on this list yet.</h3>
            <p>{first} has not added anybody. Nothing here for you to do — this list is theirs.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 236 }}>Name</th>
                  <th style={{ width: 196 }}>Status</th>
                  <th style={{ width: 118 }}>Priority</th>
                  <th style={{ width: 170 }}>Last {WEEKS} Sundays</th>
                  <th style={{ width: 160 }}>Last contact</th>
                  <th>Next due</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} className={urgency(p) === "over" ? "is-over" : undefined}>
                    <td>
                      <div className="cell-name">
                        <Avatar name={p.name} onSheet />
                        <Link href={`/people/${p.id}`}>
                          <span className="nm">{p.name}</span>
                        </Link>
                      </div>
                    </td>
                    <td>
                      <StatusChip rank={p.statusRank} />
                    </td>
                    <td>
                      <PriorityMark priority={p.priority} />
                    </td>
                    <td>
                      <SeasonBand attendance={p.attendance} weeks={WEEKS} size="sm" />
                    </td>
                    <td>
                      <div className="num">{fmtDate(p.lastContactAt)}</div>
                      <div className="t-quiet">every {span(p.intervalDays)}</div>
                    </td>
                    <td>
                      <DueFlag person={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {sorted.length > 0 && (
        <p className="t-quiet mt-3 only-desk">
          Open a name to read {poss(first)} notes and meeting log for that person — also read-only.
        </p>
      )}

      <div className="only-mob">
        <div className="row mb-3">
          <span className="label grow">
            {owner.name} · {people.length} people
          </span>
          {noEditing}
        </div>

        <div className="ro-mask">
          {sorted.length === 0 ? (
            <div className="empty">
              <h3>No one on this list yet.</h3>
              <p>{first} has not added anybody.</p>
            </div>
          ) : (
            sorted.map((p) => (
              <Link
                key={p.id}
                href={`/people/${p.id}`}
                className={urgency(p) === "over" ? "pcard is-over" : "pcard"}
              >
                <div className="pcard-top">
                  <Avatar name={p.name} onSheet />
                  <span className="nm">{p.name}</span>
                  <DueFlag person={p} />
                </div>
                <div className="pcard-meta">
                  <StatusChip rank={p.statusRank} short />
                  <PriorityMark priority={p.priority} />
                </div>
                <div className="pcard-last">
                  <Icon name="clock" size="sm" />
                  <span className="num">{fmtDate(p.lastContactAt)}</span> · every{" "}
                  {span(p.intervalDays)}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
