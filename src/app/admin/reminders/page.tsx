import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icons";
import { AdminNav, Said } from "@/components/admin/AdminNav";
import { AlertGlyph } from "@/components/admin/Glyphs";
import { SegChoice } from "@/components/admin/SegChoice";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { mailConfigured } from "@/lib/mail";
import { INTERVAL_CHOICES } from "@/lib/status";
import { span } from "@/lib/dates";
import { runRemindersNow, saveReminders } from "../actions";
import "@/styles/admin.css";

export const metadata = { title: "Reminders — Tend" };

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const REPEATS = [3, 7, 14, 21];
const ATTEMPTS = [
  { value: 1, label: "Once" },
  { value: 2, label: "2 times" },
  { value: 3, label: "3 times" },
  { value: 5, label: "5 times" },
];

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const viewer = await requireAdmin();
  const { msg, err } = await searchParams;

  const [defaults, userCount] = await Promise.all([
    db.reminderDefaults.findUnique({ where: { id: "singleton" } }),
    db.user.count(),
  ]);

  const d = defaults ?? {
    defaultIntervalDays: 14,
    sendHour: 7,
    digest: true,
    skipSunday: true,
    repeatDays: 7,
    maxAttempts: 3,
    fromName: "Tend",
    fromAddress: "reminders@example.com",
  };
  const gmail = mailConfigured();

  return (
    <AppShell
      viewer={viewer}
      current="admin"
      title="Reminders"
      sub="Defaults for everyone. A leader can change the interval on any one person."
      crumb={
        <>
          <b>Admin</b> · Reminders
        </>
      }
      actions={
        <form action={runRemindersNow}>
          <button className="btn btn--ghost btn--sm" type="submit">
            <Icon name="bell" size="sm" /> Run now
          </button>
        </form>
      }
      thumb={
        <form action={runRemindersNow} className="grow">
          <button className="btn btn--primary btn--wide" type="submit">
            <Icon name="bell" /> Run now
          </button>
        </form>
      }
    >
      <AdminNav current="reminders" users={userCount} />
      <Said msg={msg} err={err} />

      <form action={saveReminders}>
        <div className="two-col-e admin-grid">
          <div className="sheet">
            <div className="sheet-head">
              <h2>When they go out</h2>
            </div>
            <div className="sheet-body">
              <label className="field">
                <span className="label">Interval for a newly added person</span>
                <select
                  className="input"
                  name="defaultIntervalDays"
                  defaultValue={d.defaultIntervalDays}
                >
                  {[...new Set([...INTERVAL_CHOICES, d.defaultIntervalDays])]
                    .sort((a, b) => a - b)
                    .map((days) => (
                      <option key={days} value={days}>
                        {span(days)}
                      </option>
                    ))}
                </select>
              </label>

              <label className="field">
                <span className="label">Send at</span>
                <select className="input" name="sendHour" defaultValue={d.sendHour}>
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
                <p className="hint">A leader can shift their own hour. This is the one they start with.</p>
              </label>

              <div className="field">
                <span className="label" style={{ display: "block", marginBottom: 6 }}>
                  Email shape
                </span>
                <SegChoice
                  name="digest"
                  value={d.digest ? "digest" : "single"}
                  options={[
                    { value: "digest", label: "One a day, everyone in it" },
                    { value: "single", label: "One per person" },
                  ]}
                />
                <p className="hint">A leader with five people overdue gets one email, not five.</p>
              </div>

              <label className="row gap-sm" style={{ fontSize: ".8125rem" }}>
                <input
                  type="checkbox"
                  name="skipSunday"
                  defaultChecked={d.skipSunday}
                  style={{ accentColor: "var(--plot)", width: 16, height: 16 }}
                />
                No reminders on a Sunday
              </label>
            </div>
          </div>

          <div className="sheet">
            <div className="sheet-head">
              <h2>How often they repeat</h2>
            </div>
            <div className="sheet-body">
              <div className="grid-2">
                <label className="field">
                  <span className="label">Repeat every</span>
                  <select className="input" name="repeatDays" defaultValue={d.repeatDays}>
                    {[...new Set([...REPEATS, d.repeatDays])]
                      .sort((a, b) => a - b)
                      .map((days) => (
                        <option key={days} value={days}>
                          {span(days)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">At most</span>
                  <select className="input" name="maxAttempts" defaultValue={d.maxAttempts}>
                    {ATTEMPTS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="hint">
                After that it stops emailing, and stays in the Follow-ups inbox until it is logged.
              </p>

              <div className="divider" />

              <span className="label" style={{ display: "block", marginBottom: 10 }}>
                Channels
              </span>

              <div className="logrow">
                <Icon name="mail" style={{ color: "var(--ink-3)" }} />
                <span className="grow">
                  <b>Gmail</b>
                  <br />
                  <span className="t-quiet">
                    {gmail
                      ? `Sent from ${d.fromName} <${d.fromAddress}>`
                      : "Not set up — reminders are written to the console instead"}
                  </span>
                </span>
                {gmail ? (
                  <span className="flag flag--ok">
                    <Icon name="check" size="sm" /> Ready
                  </span>
                ) : (
                  <span className="flag flag--soon">
                    <AlertGlyph size="sm" /> Not set up
                  </span>
                )}
              </div>

              <div className="logrow">
                <Icon name="bell" style={{ color: "var(--ink-3)" }} />
                <span className="grow">
                  <b>In the app</b>
                  <br />
                  <span className="t-quiet">A count on Follow-ups</span>
                </span>
                <span className="flag flag--ok">
                  <Icon name="check" size="sm" /> Always on
                </span>
              </div>

              <div className="grid-2 mt-4">
                <label className="field">
                  <span className="label">From name</span>
                  <input className="input" name="fromName" defaultValue={d.fromName} />
                </label>
                <label className="field">
                  <span className="label">From address</span>
                  <input
                    className="input"
                    name="fromAddress"
                    type="email"
                    defaultValue={d.fromAddress}
                  />
                </label>
              </div>

              <div className="row mt-5">
                <Link className="btn btn--quiet" href="/follow-ups">
                  See the inbox
                </Link>
                <button className="btn btn--primary push" type="submit">
                  <Icon name="check" /> Save defaults
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
