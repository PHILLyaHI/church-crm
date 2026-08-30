import { AppShell } from "@/components/AppShell";
import { Avatar, Icon } from "@/components/Icons";
import { EditMe } from "@/components/settings/EditMe";
import { signOut } from "@/auth";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/permissions";
import { roleLabel } from "@/lib/status";

export const metadata = { title: "Settings — Tend" };

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const account = await db.user.findUnique({
    where: { id: viewer.id },
    select: { timezone: true, sendHour: true, createdAt: true },
  });

  const joined = account?.createdAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell
      viewer={viewer}
      current="settings"
      title="Settings"
      sub="Your account, and the way Tend reaches you."
      crumb={<b>Settings</b>}
    >
      <section className="sheet">
        <div className="sheet-head">
          <h2>You</h2>
          <span className="right">
            <EditMe
              me={{
                name: viewer.name,
                email: viewer.email,
                timezone: account?.timezone ?? "Europe/London",
                sendHour: account?.sendHour ?? 7,
              }}
            />
          </span>
        </div>
        <div className="sheet-body">
          <div className="row gap-sm" style={{ alignItems: "center", marginBottom: "var(--s4)" }}>
            <Avatar name={viewer.name} large onSheet />
            <span>
              <b style={{ fontSize: "var(--t-sub)" }}>{viewer.name}</b>
              <br />
              <span className="t-quiet">{viewer.email}</span>
            </span>
          </div>

          <dl className="kv">
            <dt>Role</dt>
            <dd className="left">{roleLabel(viewer.role)}</dd>
            <dt>Time zone</dt>
            <dd className="left">{account?.timezone ?? "Europe/London"}</dd>
            <dt>Reminder email</dt>
            <dd className="left">Around {String(account?.sendHour ?? 7).padStart(2, "0")}:00, never on a Sunday</dd>
            {joined && (
              <>
                <dt>With you since</dt>
                <dd className="left">{joined}</dd>
              </>
            )}
          </dl>
        </div>
      </section>

      <section className="sheet">
        <div className="sheet-head">
          <h2>This device</h2>
        </div>
        <div className="sheet-body">
          <p className="t-quiet">
            Signing out ends this session here. Your people, notes and reminders are untouched.
          </p>
          <form
            className="mt-4"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/sign-in" });
            }}
          >
            <button type="submit" className="btn btn--ghost">
              <Icon name="out" size="sm" /> Sign out
            </button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
