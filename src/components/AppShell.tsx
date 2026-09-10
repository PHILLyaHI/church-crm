import Link from "next/link";
import { db } from "@/lib/db";
import { Icon, Avatar } from "@/components/Icons";
import { urgency } from "@/lib/dates";
import { roleLabel } from "@/lib/status";
import type { Viewer } from "@/lib/permissions";

export type NavKey = "people" | "followups" | "team" | "import" | "admin" | "settings";

export async function shellCounts(viewer: Viewer) {
  const people = await db.person.findMany({
    where: { ownerId: viewer.id, archivedAt: null },
    select: {
      lastContactAt: true,
      intervalDays: true,
      createdAt: true,
      snoozedUntil: true,
      remindersPaused: true,
    },
  });
  return {
    people: people.length,
    overdue: people.filter((p) => urgency(p) === "over").length,
  };
}

type Props = {
  viewer: Viewer;
  current: NavKey;
  title: string;
  /** Sits under the title on both shells. */
  sub?: React.ReactNode;
  crumb?: React.ReactNode;
  /** Desktop only: the right side of the page head. */
  actions?: React.ReactNode;
  /** Phone only: the one action in the thumb zone. */
  thumb?: React.ReactNode;
  /** Phone only: a back link replaces the title block. */
  back?: { href: string; label: string };
  children: React.ReactNode;
};

export async function AppShell({
  viewer,
  current,
  title,
  sub,
  crumb,
  actions,
  thumb,
  back,
  children,
}: Props) {
  const counts = await shellCounts(viewer);
  const showAdmin = viewer.role === "admin";
  // Team is for everyone: it is where a leader builds one, not only where
  // they look at one. Upward stays hidden — the page shows only who reports
  // to you, never who you report to.
  const nav = [
    { key: "people" as NavKey, href: "/people", icon: "people", label: "People", count: counts.people, quiet: true },
    { key: "followups" as NavKey, href: "/follow-ups", icon: "bell", label: "Follow-ups", count: counts.overdue, quiet: false },
    { key: "team" as NavKey, href: "/team", icon: "team", label: "Team", count: 0, quiet: true },
    { key: "import" as NavKey, href: "/add", icon: "upload", label: "Add people", count: 0, quiet: true },
    ...(showAdmin ? [{ key: "admin" as NavKey, href: "/admin", icon: "admin", label: "Admin", count: 0, quiet: true }] : []),
  ];

  const tabs = nav.filter((n) => n.key !== "admin").slice(0, 4);

  return (
    <div className="shell">
      <aside className="rail on-plot only-desk">
        <div className="rail-mark">
          <svg viewBox="0 0 24 24" strokeLinejoin="round"><use href="#ic-mark" /></svg>
          <b>Tend</b>
        </div>
        <nav>
          {nav.map((n) => (
            <Link key={n.key} href={n.href} aria-current={current === n.key ? "page" : undefined}>
              <Icon name={n.icon} /> {n.label}
              {n.count > 0 && <span className={n.quiet ? "count quiet num" : "count num"}>{n.count}</span>}
            </Link>
          ))}
        </nav>
        <div className="rail-foot">
          <div className="rail-who">
            <Avatar name={viewer.name} />
            <span className="rail-who-text">
              <span className="who-name">{viewer.name}</span>
              <span className="who-role">{roleLabel(viewer.role)}</span>
            </span>
            <Link
              className="rail-cog"
              href="/settings"
              aria-label="Settings"
              aria-current={current === "settings" ? "page" : undefined}
            >
              <Icon name="cog" />
            </Link>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar only-desk">
          <span className="crumb">{crumb ?? <b>{title}</b>}</span>
          <div className="topbar-tools">
            <Link className="icon-btn" href="/follow-ups" aria-label="Follow-ups">
              <Icon name="bell" />
              {counts.overdue > 0 && <span className="dot" />}
            </Link>
          </div>
        </div>

        <header className="m-top on-plot only-mob">
          {back ? (
            <div className="m-top-row">
              <Link className="m-back" href={back.href}>
                <Icon name="left" size="sm" /> {back.label}
              </Link>
            </div>
          ) : (
            // No bell here: the tab bar already carries Follow-ups, with the
            // count rather than just a dot. Two doors to one room.
            <div className="m-top-row">
              <div className="grow">
                <h1>{title}</h1>
                {sub && <div className="m-sub">{sub}</div>}
              </div>
            </div>
          )}
        </header>

        <div className="content">
          <div className="head-row only-desk">
            <div className="page-head">
              <h1>{title}</h1>
              {sub && <div className="sub">{sub}</div>}
            </div>
            {actions}
          </div>
          {children}
        </div>
      </div>

      {thumb && <div className="m-thumb only-mob">{thumb}</div>}

      <nav className="m-tabs only-mob">
        {tabs.map((n) => (
          <Link key={n.key} href={n.href} aria-current={current === n.key ? "page" : undefined}>
            <Icon name={n.icon} />
            {n.label}
            {n.key === "followups" && counts.overdue > 0 && <span className="count num">{counts.overdue}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
