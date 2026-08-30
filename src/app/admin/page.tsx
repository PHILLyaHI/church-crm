import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Avatar, Icon } from "@/components/Icons";
import { AdminNav, Said } from "@/components/admin/AdminNav";
import { AlertGlyph, LinkGlyph } from "@/components/admin/Glyphs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { getConfig } from "@/lib/airtable";
import { ago, fmtDate } from "@/lib/dates";
import { roleLabel } from "@/lib/status";
import { inviteUser, linkLeader, setRole } from "./actions";
import "@/styles/admin.css";

export const metadata = { title: "Admin — Tend" };

const ROLE_ORDER: Record<string, number> = { higher_leader: 0, leader: 1, admin: 2 };

function tagClass(role: string) {
  return role === "admin" ? "tag tag--admin" : role === "higher_leader" ? "tag tag--higher" : "tag";
}

function seen(at: Date | null) {
  if (!at) return "Never";
  const words = ago(at);
  if (words === "Today") {
    return `Today, ${at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return words.endsWith("weeks ago") ? fmtDate(at) : words;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const viewer = await requireAdmin();
  const { msg, err } = await searchParams;

  const [rows, owned, config, defaults] = await Promise.all([
    db.user.findMany({
      include: { leader: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    db.person.groupBy({ by: ["ownerId"], where: { archivedAt: null }, _count: { _all: true } }),
    getConfig(),
    db.reminderDefaults.findUnique({ where: { id: "singleton" } }),
  ]);

  const carried = new Map(owned.map((o) => [o.ownerId, o._count._all]));
  const users = [...rows].sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 1) - (ROLE_ORDER[b.role] ?? 1) || a.name.localeCompare(b.name),
  );

  const people = (id: string) => carried.get(id) ?? 0;
  const reportsOf = (id: string) => users.filter((u) => u.leaderId === id);

  const above = users.filter((u) => u.role === "higher_leader" || reportsOf(u.id).length > 0);
  const unlinked = users.filter((u) => u.role === "leader" && !u.leaderId);
  // An admin sits outside the tree; everyone else can be linked either way up.
  const leaders = users.filter((u) => u.role !== "admin");
  const canLead = users.filter((u) => u.role === "higher_leader" || u.role === "admin");
  const connected = Boolean(config?.enabled && config.token && config.baseId);

  return (
    <AppShell
      viewer={viewer}
      current="admin"
      title="Admin"
      sub={
        <>
          <span className="num">{users.length}</span> users ·{" "}
          {connected ? "Airtable connected" : "Airtable not connected"}
        </>
      }
    >
      <AdminNav current="users" users={users.length} />
      <Said msg={msg} err={err} />

      {/* The phone gets the four doors first, then the same sections under them. */}
      <div className="m-sheet mb-5 only-mob">
        <a className="m-row" href="#users" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="grow">
            <b>Users and roles</b>
          </span>
          <span className="t-quiet num">{users.length}</span>
          <Icon name="chev" size="sm" style={{ color: "var(--ink-3)" }} />
        </a>
        <a className="m-row" href="#who" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="grow">
            <b>Who reports to whom</b>
          </span>
          {unlinked.length > 0 ? (
            <span className="flag flag--soon">{unlinked.length} unlinked</span>
          ) : (
            <span className="t-quiet num">{above.length}</span>
          )}
          <Icon name="chev" size="sm" style={{ color: "var(--ink-3)" }} />
        </a>
        <Link
          className="m-row"
          href="/admin/reminders"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <span className="grow">
            <b>Reminders</b>
          </span>
          <span className="t-quiet num">
            {String(defaults?.sendHour ?? 7).padStart(2, "0")}:00
          </span>
          <Icon name="chev" size="sm" style={{ color: "var(--ink-3)" }} />
        </Link>
      </div>

      {/* ------------------------------------------------------------ USERS */}
      <section id="users" className="mb-5">
        <div className="head-row">
          <div className="page-head">
            <h1>
              <span className="num">{users.length}</span> users
            </h1>
            <p className="sub">Roles are set here and nowhere else. Nobody chooses their own.</p>
          </div>
          <a className="btn btn--primary" href="#invite">
            <Icon name="plus" /> Invite someone
          </a>
        </div>

        <div className="sheet">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 220 }}>Name</th>
                  <th style={{ width: 250 }}>Email</th>
                  <th style={{ width: 150 }}>Role</th>
                  <th style={{ width: 180 }}>Reports to</th>
                  <th style={{ width: 90 }}>People</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-name">
                        <Avatar name={u.name} onSheet />
                        <span className="nm">{u.name}</span>
                      </div>
                    </td>
                    <td className="t-quiet">{u.email}</td>
                    <td>
                      <span className={tagClass(u.role)}>{roleLabel(u.role)}</span>
                    </td>
                    <td>
                      {u.leader ? (
                        u.leader.name
                      ) : u.role === "leader" ? (
                        <span className="flag flag--soon">
                          <AlertGlyph size="sm" /> Not set
                        </span>
                      ) : (
                        <span className="t-quiet">—</span>
                      )}
                    </td>
                    <td className="t-quiet num">{people(u.id)}</td>
                    <td>
                      {u.invitedAt && !u.lastSeenAt ? (
                        <span className="tag tag--invited">Invited {fmtDate(u.invitedAt)}</span>
                      ) : (
                        <span className="t-quiet num">{seen(u.lastSeenAt)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sheet mt-4">
          <div className="sheet-head">
            <h2>Change a role</h2>
            <span className="sheet-note">A higher leader reads downward. An admin sees this screen.</span>
          </div>
          <div className="sheet-body">
            <form action={setRole} className="row wrap gap-sm">
              <span className="label">Make</span>
              <select
                className="input"
                name="userId"
                aria-label="Who"
                style={{ height: 38, width: 220, fontSize: ".8125rem" }}
              >
                {users
                  .filter((u) => u.id !== viewer.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
              <span className="label">a</span>
              <select
                className="input"
                name="role"
                aria-label="Which role"
                style={{ height: 38, width: 180, fontSize: ".8125rem" }}
              >
                <option value="leader">Leader</option>
                <option value="higher_leader">Higher leader</option>
                <option value="admin">Admin</option>
              </select>
              <button className="btn btn--primary" type="submit">
                <Icon name="check" size="sm" /> Set role
              </button>
            </form>
          </div>
        </div>

        <div className="sheet mt-4" id="invite">
          <div className="sheet-head">
            <h2>Invite someone</h2>
            <span className="sheet-note">The account is made now; they set their own password.</span>
          </div>
          <div className="sheet-body">
            <form action={inviteUser}>
              <div className="grid-2">
                <label className="field">
                  <span className="label">Name</span>
                  <input className="input" name="name" placeholder="Priya Nandakumar" required />
                </label>
                <label className="field">
                  <span className="label">Email</span>
                  <input
                    className="input"
                    name="email"
                    type="email"
                    placeholder="p.nandakumar@fieldgate.church"
                    required
                  />
                </label>
              </div>
              <div className="grid-2">
                <label className="field">
                  <span className="label">Role</span>
                  <select className="input" name="role" defaultValue="leader">
                    <option value="leader">Leader</option>
                    <option value="higher_leader">Higher leader</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="field">
                  <span className="label">Reports to</span>
                  <select className="input" name="leaderId" defaultValue="">
                    <option value="">Nobody yet</option>
                    {canLead.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="btn btn--primary" type="submit">
                <Icon name="mail" /> Send the invitation
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- HIERARCHY */}
      <section id="who" className="mb-5">
        <div className="page-head">
          <h1>Who reports to whom</h1>
          <p className="sub">
            A higher leader can read their leaders&rsquo; people. It never works the other way.
          </p>
        </div>

        <div className="sheet">
          <div className="sheet-body">
            <div className="hier">
              <div className="hier-col">
                <span className="label" style={{ display: "block", margin: "2px 4px 8px" }}>
                  Higher leaders
                </span>
                {above.length === 0 && (
                  <p className="t-quiet">Nobody has anyone reporting to them yet.</p>
                )}
                {above.map((u) => {
                  const kids = reportsOf(u.id);
                  const total = kids.reduce((n, k) => n + people(k.id), 0);
                  return (
                    <div key={u.id}>
                      <div className="hier-item mt-3">
                        <Avatar name={u.name} onSheet />
                        <span className="grow">
                          <b>{u.name}</b>
                        </span>
                        <span className="t-quiet num">
                          {kids.length} {kids.length === 1 ? "leader" : "leaders"} · {total} people
                        </span>
                      </div>
                      {kids.length > 0 && (
                        <div className="hier-sub">
                          {kids.map((k) => (
                            <div className="hier-item" key={k.id}>
                              <Avatar name={k.name} onSheet />
                              <span className="grow">{k.name}</span>
                              <span className="t-quiet num">{people(k.id)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="hier-link">
                <LinkGlyph size="lg" />
              </div>

              <div className="hier-col">
                <span className="label" style={{ display: "block", margin: "2px 4px 8px" }}>
                  Not linked to anyone
                </span>
                {unlinked.length === 0 && <p className="t-quiet">Everyone is linked.</p>}
                {unlinked.map((u) => (
                  <div className="hier-item is-free" key={u.id}>
                    <Avatar name={u.name} onSheet />
                    <span className="grow">{u.name}</span>
                    {u.invitedAt && !u.lastSeenAt ? (
                      <span className="tag tag--invited">Invited</span>
                    ) : (
                      <span className="t-quiet num">{people(u.id)}</span>
                    )}
                  </div>
                ))}
                <p className="t-quiet mt-4">
                  An unlinked leader still keeps their own people. Nobody can read them until they
                  are linked.
                </p>
              </div>
            </div>

            <div className="divider" />

            <form action={linkLeader} className="row wrap gap-sm">
              <span className="label">Link</span>
              <select
                className="input"
                name="userId"
                aria-label="Which leader"
                style={{ height: 38, width: 220, fontSize: ".8125rem" }}
              >
                {leaders.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <span className="label">to report to</span>
              <select
                className="input"
                name="leaderId"
                aria-label="Which higher leader"
                style={{ height: 38, width: 220, fontSize: ".8125rem" }}
              >
                {canLead.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
                <option value="">Nobody</option>
              </select>
              <button className="btn btn--primary" type="submit">
                <LinkGlyph size="sm" /> Link them
              </button>
            </form>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
