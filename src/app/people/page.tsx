import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Avatar, Icon } from "@/components/Icons";
import { DueFlag, PriorityMark, StatusChip } from "@/components/PersonBits";
import { LogContact } from "@/components/people/LogContact";
import { SeasonBandPick } from "@/components/people/SeasonBandPick";
import { FilterRow, FilterStrip, SortSelect } from "@/components/people/PeopleControls";
import { readView, sortNote } from "@/components/people/view";
import { db } from "@/lib/db";
import { daysOverdue, fmtDate, fmtDay, span, urgency } from "@/lib/dates";
import { requireViewer } from "@/lib/permissions";

import "@/styles/people.css";

const PRI_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireViewer();
  const view = readView(await searchParams);

  const people = await db.person.findMany({
    where: { ownerId: viewer.id, archivedAt: null },
    include: { attendance: { select: { serviceDate: true, state: true } } },
  });

  const counts = {
    all: people.length,
    over: people.filter((p) => urgency(p) === "over").length,
    soon: people.filter((p) => urgency(p) === "soon").length,
    high: people.filter((p) => p.priority === "high").length,
  };

  let rows = people.filter((p) => {
    if (view.s && String(p.statusRank) !== view.s) return false;
    if (view.f === "over") return urgency(p) === "over";
    if (view.f === "soon") return urgency(p) === "soon";
    if (view.f === "high") return p.priority === "high";
    return true;
  });

  const byWait = (a: (typeof people)[number], b: (typeof people)[number]) =>
    daysOverdue(b) - daysOverdue(a) ||
    PRI_ORDER[a.priority] - PRI_ORDER[b.priority] ||
    a.name.localeCompare(b.name);

  rows = [...rows].sort((a, b) => {
    switch (view.sort) {
      case "name":
        return a.name.localeCompare(b.name);
      case "priority":
        return PRI_ORDER[a.priority] - PRI_ORDER[b.priority] || byWait(a, b);
      case "ladder":
        return b.statusRank - a.statusRank || a.name.localeCompare(b.name);
      case "added":
        return b.createdAt.getTime() - a.createdAt.getTime();
      default:
        return byWait(a, b);
    }
  });

  const empty = counts.all === 0;

  return (
    <AppShell
      viewer={viewer}
      current="people"
      crumb={<b>People</b>}
      title={`${counts.all} ${counts.all === 1 ? "person" : "people"}`}
      sub={
        <>
          {counts.over > 0 && (
            <>
              <span className="over-n num">{counts.over} overdue</span> ·{" "}
            </>
          )}
          <span className="only-desk">{sortNote(view.sort)}</span>
          <span className="only-mob num">{fmtDay(new Date())}</span>
        </>
      }
      actions={
        <span className="row gap-sm">
          {counts.all > 0 && <SortSelect view={view} />}
          <Link className="btn btn--primary" href="/add">
            <Icon name="plus" size="sm" /> Add people
          </Link>
        </span>
      }
      thumb={
        <Link className="btn btn--primary" href="/add">
          <Icon name="plus" /> Add a person
        </Link>
      }
    >
      <div className="plot-page">
        {!empty && (
          <>
            <FilterStrip counts={counts} view={view} />
            <FilterRow counts={counts} view={view} />
          </>
        )}

        {/* ---- desktop: the sheet ---- */}
        <div className="sheet only-desk">
          {rows.length === 0 ? (
            <div className="empty">
              <div className="empty-plot">
                <i />
                <i />
                <i />
                <i />
              </div>
              <h3>{empty ? "Nobody here yet" : "Nobody matches"}</h3>
              <p>
                {empty
                  ? "Add your first person, or bring a whole list in."
                  : "Change the filter, or clear it to see everyone."}
              </p>
              {empty && (
                <Link className="btn btn--primary" href="/add">
                  <Icon name="plus" size="sm" /> Add people
                </Link>
              )}
            </div>
          ) : (
            <div className="table-scroll rise">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 224 }}>Name</th>
                    <th style={{ width: 186 }}>Status</th>
                    <th style={{ width: 112 }}>Priority</th>
                    <th style={{ width: 150 }}>Last 16 Sundays</th>
                    <th style={{ width: 152 }}>Last contact</th>
                    <th style={{ width: 106 }}>Next due</th>
                    <th style={{ width: 128 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const over = urgency(p) === "over";
                    const log = (
                      <LogContact
                        personId={p.id}
                        name={p.name}
                        className={over ? "btn btn--ghost btn--sm" : "btn btn--quiet btn--sm"}
                      />
                    );
                    return (
                      <tr key={p.id} className={over ? "rowlink is-over" : "rowlink"}>
                        <td className="rowlink-cell">
                          <div className="cell-name">
                            <Avatar name={p.name} onSheet />
                            <Link className="stretch" href={`/people/${p.id}`}>
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
                        <td className="td-live">
                          <SeasonBandPick personId={p.id} name={p.name} attendance={p.attendance} size="sm" />
                        </td>
                        <td>
                          <div className="num">{fmtDate(p.lastContactAt)}</div>
                          <div className="t-quiet">check in every {span(p.intervalDays)}</div>
                        </td>
                        <td>
                          <DueFlag person={p} />
                        </td>
                        <td style={{ textAlign: "right" }}>{log}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ---- phone: one card per person ---- */}
        <div className="only-mob">
          {rows.length === 0 ? (
            <div className="sheet">
              <div className="empty">
                <div className="empty-plot">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <h3>{empty ? "Nobody here yet" : "Nobody matches"}</h3>
                <p>{empty ? "Add your first person." : "Change the filter, or clear it."}</p>
              </div>
            </div>
          ) : (
            rows.map((p, i) => (
              // The card is the link — the whole of it, name to band. The one
              // button on it sits above that, and says so by being on top.
              <div
                key={p.id}
                className={urgency(p) === "over" ? "pcard is-over rise" : "pcard rise"}
                style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
              >
                <Link className="stretch" href={`/people/${p.id}`} aria-label={p.name} />
                <div className="pcard-top">
                  <Avatar name={p.name} onSheet />
                  <span className="nm">{p.name}</span>
                  <DueFlag person={p} />
                </div>
                <div className="pcard-meta">
                  <StatusChip rank={p.statusRank} short />
                  <PriorityMark priority={p.priority} />
                </div>
                <div className="pcard-band">
                  <SeasonBandPick personId={p.id} name={p.name} attendance={p.attendance} />
                </div>
                <div className="pcard-foot">
                  <span className="pcard-last">
                    <Icon name="clock" size="sm" />
                    <span className="pcard-last-text">
                      <span className="num">{fmtDate(p.lastContactAt)}</span> · every{" "}
                      {span(p.intervalDays)}
                    </span>
                  </span>
                  <LogContact personId={p.id} name={p.name} className="btn btn--ghost btn--sm push" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
