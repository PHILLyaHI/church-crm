import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Avatar, Icon } from "@/components/Icons";
import { Spread } from "@/components/PersonBits";
import { InviteSubLeader, ShareLink } from "@/components/team/InviteSubLeader";
import { db } from "@/lib/db";
import { ago, urgency } from "@/lib/dates";
import { LADDER, roleLabel } from "@/lib/status";
import { directReportIds, requireViewer } from "@/lib/permissions";
import { inviteLink } from "@/lib/team";
import { revokeInvite } from "./actions";

export const metadata = { title: "Team — Tend" };

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function activeLine(lastSeenAt: Date | null) {
  if (!lastSeenAt) return "Not signed in yet";
  return `Active ${ago(lastSeenAt).toLowerCase()}`;
}

/**
 * The people who report to you, and the way to add more. Only downward is
 * ever shown: this page never says who you report to.
 */
export default async function TeamPage() {
  const viewer = await requireViewer();
  const ids = await directReportIds(viewer.id);

  const [rows, invites] = await Promise.all([
    db.user.findMany({
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
    }),
    db.teamInvite.findMany({
      where: { inviterId: viewer.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, token: true, createdAt: true },
    }),
  ]);

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
  const none = leaders.length === 0;

  const inviteCard = (
    <section className="sheet">
      <div className="sheet-head">
        <h2>Add a sub-leader</h2>
      </div>
      <div className="sheet-body">
        <InviteSubLeader />
      </div>
    </section>
  );

  const pendingCard = invites.length > 0 && (
    <section className="sheet">
      <div className="sheet-head">
        <h2>Waiting on a reply</h2>
        <span className="sheet-note num">{invites.length}</span>
      </div>
      <div className="sheet-body">
        <div className="invites">
          {invites.map((i) => (
            <div className="invite-row" key={i.id}>
              <div className="invite-who">
                <b>{i.email}</b>
                <span className="t-quiet num">sent {ago(i.createdAt).toLowerCase()}</span>
                <form action={revokeInvite}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="invite-take" type="submit" aria-label={`Take back the invitation to ${i.email}`}>
                    <Icon name="x" size="sm" /> Take it back
                  </button>
                </form>
              </div>
              <ShareLink link={inviteLink(i.token)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const empty = (
    <section className="sheet">
      <div className="empty">
        <div className="empty-plot">
          <i />
          <i />
          <i />
          <i />
        </div>
        <h3>Nobody reports to you yet.</h3>
        <p>
          Invite a leader and you will be able to read their people — read only, and the screen will
          always say whose list it is.
        </p>
      </div>
    </section>
  );

  return (
    <AppShell
      viewer={viewer}
      current="team"
      title={none ? "Your team" : `${plural(leaders.length, "leader", "leaders")}, ${plural(people, "person", "people")}`}
      sub={
        none ? (
          <>Invite the leaders you look after.</>
        ) : overdue > 0 ? (
          <>
            <span className="over-n num">{overdue}</span> waiting across the team
          </>
        ) : (
          <>Everyone is on time.</>
        )
      }
    >
      {/* ===================== DESKTOP ===================== */}
      <div className="two-col only-desk">
        <div>
          {none ? (
            empty
          ) : (
            <div className="plots plots--3">
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
          )}
        </div>
        <div>
          {inviteCard}
          {pendingCard}
        </div>
      </div>

      {/* ====================== PHONE ====================== */}
      <div className="only-mob">
        <div className="m-sec">
          <span className="label">Add a sub-leader</span>
          <div className="m-sheet">
            <div className="m-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <InviteSubLeader />
            </div>
          </div>
        </div>

        {invites.length > 0 && (
          <div className="m-sec">
            <span className="label">Waiting on a reply</span>
            <div className="m-sheet">
              {invites.map((i) => (
                <div className="m-row" key={i.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                  <div className="invite-who">
                    <b>{i.email}</b>
                    <span className="t-quiet num">sent {ago(i.createdAt).toLowerCase()}</span>
                    <form action={revokeInvite}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="invite-take" type="submit" aria-label={`Take back the invitation to ${i.email}`}>
                        <Icon name="x" size="sm" /> Take it back
                      </button>
                    </form>
                  </div>
                  <ShareLink link={inviteLink(i.token)} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="m-sec">
          <span className="label">Your team</span>
          {none ? (
            empty
          ) : (
            <div className="m-sheet">
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
          )}
        </div>
      </div>
    </AppShell>
  );
}
