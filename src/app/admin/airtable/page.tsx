import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icons";
import { StatusChip } from "@/components/PersonBits";
import { AdminNav, Said } from "@/components/admin/AdminNav";
import { AlertGlyph } from "@/components/admin/Glyphs";
import { splitMapping } from "@/components/admin/mapping";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { getConfig, readStatusOptions } from "@/lib/airtable";
import { ago, fmtDate } from "@/lib/dates";
import { LADDER } from "@/lib/status";
import {
  disconnectAirtable,
  resolveOption,
  saveAirtable,
  saveMapping,
  syncNow,
} from "../actions";
import "@/styles/admin.css";

export const metadata = { title: "Airtable — Tend" };

function when(at: Date) {
  const words = ago(at);
  const clock = at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (words === "Today") return `Today, ${clock}`;
  if (words === "Yesterday") return `Yesterday, ${clock}`;
  return `${fmtDate(at)}, ${clock}`;
}

function Direction({ d }: { d: string }) {
  if (d === "in")
    return (
      <span className="dirn">
        Airtable <Icon name="arrow-r" size="sm" /> Tend
      </span>
    );
  if (d === "out")
    return (
      <span className="dirn">
        Tend <Icon name="arrow-r" size="sm" /> Airtable
      </span>
    );
  return <span className="dirn">{d === "conflict" ? "Both changed" : "Full sync"}</span>;
}

function Result({ result }: { result: string }) {
  if (result === "applied")
    return (
      <span className="flag flag--ok">
        <Icon name="check" size="sm" /> Applied
      </span>
    );
  if (result === "conflict") return <span className="flag flag--read">Both changed</span>;
  return (
    <span className="flag flag--soon">
      <AlertGlyph size="sm" /> Skipped
    </span>
  );
}

export default async function AirtablePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const viewer = await requireAdmin();
  const { msg, err } = await searchParams;

  const config = await getConfig();
  const { steps, ignored } = splitMapping(config?.mapping ?? {});

  const [options, events, leaders, userCount] = await Promise.all([
    readStatusOptions(),
    db.syncEvent.findMany({
      orderBy: { at: "desc" },
      take: 25,
      include: { person: { select: { name: true } } },
    }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.count(),
  ]);

  const connected = Boolean(config?.enabled && config.token && config.baseId && config.tableName);
  const mapped = new Set(Object.values(steps).map((o) => o.toLowerCase()));
  const skipped = new Set(ignored.map((o) => o.toLowerCase()));

  // Anything Airtable offers — or anything a sync has already tripped over —
  // that no step claims and nobody has chosen to ignore.
  const seen = new Map<string, string>();
  for (const o of options) seen.set(o.toLowerCase(), o);
  for (const e of events) {
    if (e.direction === "in" && e.result === "skipped" && e.fromValue) {
      seen.set(e.fromValue.toLowerCase(), e.fromValue);
    }
  }
  const unmapped = [...seen.entries()]
    .filter(([key]) => !mapped.has(key) && !skipped.has(key))
    .map(([, name]) => name);

  const status = connected ? (
    <span className="sync-status">
      <i /> Connected
    </span>
  ) : (
    <span className="sync-status sync-status--off">
      <i /> Not connected
    </span>
  );

  return (
    <AppShell
      viewer={viewer}
      current="admin"
      title="Airtable"
      sub="Status moves both ways. Nothing else is shared."
      crumb={
        <>
          <b>Admin</b> · Airtable
        </>
      }
      actions={
        <span className="row gap-sm">
          {status}
          <form action={syncNow}>
            <button className="btn btn--ghost btn--sm" type="submit">
              <Icon name="sync" size="sm" /> Sync now
            </button>
          </form>
        </span>
      }
      thumb={
        <form action={syncNow} className="grow">
          <button className="btn btn--primary btn--wide" type="submit">
            <Icon name="sync" /> Sync now
          </button>
        </form>
      }
    >
      <AdminNav current="airtable" users={userCount} />
      <Said msg={msg} err={err} />

      {unmapped.map((option) => (
        <div className="banner banner--warn mb-3" key={option}>
          <AlertGlyph />
          <span>
            <b>“{option}” isn&rsquo;t mapped.</b> Records with it are left alone.
          </span>
          <span className="right">
            <form action={resolveOption} className="row gap-sm">
              <input type="hidden" name="option" value={option} />
              <select
                className="input"
                name="answer"
                aria-label={`What “${option}” means`}
                style={{ height: 32, width: 170, fontSize: ".8125rem" }}
                defaultValue="ignore"
              >
                {LADDER.map((s) => (
                  <option key={s.rank} value={s.rank}>
                    {s.rank} {s.name}
                  </option>
                ))}
                <option value="ignore">Ignore this option</option>
              </select>
              <button className="btn btn--ghost btn--sm" type="submit">
                Set
              </button>
            </form>
          </span>
        </div>
      ))}

      <div className="two-col-e admin-grid">
        {/* --------------------------------------------------- connection */}
        <div className="sheet">
          <div className="sheet-head">
            <h2>Connection</h2>
            <span className="right">{status}</span>
          </div>
          <div className="sheet-body">
            <dl className="kv">
              <dt>Token</dt>
              <dd>{config?.token ? "Personal access token · set" : "Not set"}</dd>
              <dt>Base</dt>
              <dd className="num">{config?.baseId || "—"}</dd>
              <dt>Table</dt>
              <dd>{config?.tableName || "—"}</dd>
              <dt>View</dt>
              <dd>{config?.viewName || "All records"}</dd>
              <dt>Matched on</dt>
              <dd>
                {config?.tendIdField ?? "Tend ID"} <span className="t-quiet">(hidden field)</span>
              </dd>
              <dt>Last checked</dt>
              <dd className="num">{config?.lastSyncAt ? when(config.lastSyncAt) : "Never"}</dd>
              <dt>Runs</dt>
              <dd>On every status change, and on Sync now</dd>
            </dl>

            <div className="divider" />

            <form action={saveAirtable}>
              <label className="field">
                <span className="label">Personal access token</span>
                <input
                  className="input"
                  name="token"
                  type="password"
                  autoComplete="off"
                  placeholder={config?.token ? "Leave blank to keep the one saved" : "pat…"}
                />
                <p className="hint">
                  A token is never shown again once it is saved. Paste a new one to replace it.
                </p>
              </label>
              <div className="grid-2">
                <label className="field">
                  <span className="label">Base</span>
                  <input
                    className="input"
                    name="baseId"
                    defaultValue={config?.baseId ?? ""}
                    placeholder="appK2r9vQm3XbLd0"
                  />
                </label>
                <label className="field">
                  <span className="label">Table</span>
                  <input
                    className="input"
                    name="tableName"
                    defaultValue={config?.tableName ?? ""}
                    placeholder="People"
                  />
                </label>
              </div>
              <div className="grid-2">
                <label className="field">
                  <span className="label">View</span>
                  <input
                    className="input"
                    name="viewName"
                    defaultValue={config?.viewName ?? ""}
                    placeholder="All people"
                  />
                </label>
                <label className="field">
                  <span className="label">Tend ID field</span>
                  <input
                    className="input"
                    name="tendIdField"
                    defaultValue={config?.tendIdField ?? "Tend ID"}
                  />
                </label>
              </div>
              <div className="grid-2">
                <label className="field">
                  <span className="label">Status field</span>
                  <input
                    className="input"
                    name="statusField"
                    defaultValue={config?.statusField ?? "Status"}
                  />
                </label>
                <label className="field">
                  <span className="label">New records belong to</span>
                  <select
                    className="input"
                    name="defaultOwnerId"
                    defaultValue={config?.defaultOwnerId ?? ""}
                  >
                    <option value="">Nobody — leave them in Airtable</option>
                    {leaders.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="row gap-sm mb-4" style={{ fontSize: ".8125rem" }}>
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={config?.enabled ?? false}
                  style={{ accentColor: "var(--plot)", width: 16, height: 16 }}
                />
                Sync is on
              </label>
              <button className="btn btn--primary" type="submit">
                <Icon name="check" /> Save connection
              </button>
            </form>

            <div className="row gap-sm mt-4">
              <form action={syncNow}>
                <button className="btn btn--ghost btn--sm" type="submit">
                  <Icon name="sync" size="sm" /> Sync now
                </button>
              </form>
              <form action={disconnectAirtable} className="push">
                <button className="btn btn--quiet btn--sm" style={{ color: "var(--over)" }} type="submit">
                  Disconnect
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------ mapping */}
        <div className="sheet">
          <div className="sheet-head">
            <h2>Status field mapping</h2>
            <span className="sheet-note">
              {options.length > 0
                ? `Single select · “${config?.statusField ?? "Status"}”`
                : "Type the option names as Airtable spells them"}
            </span>
          </div>
          <div className="sheet-body">
            <form action={saveMapping}>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>In Tend</th>
                      <th style={{ width: 32 }} />
                      <th>In Airtable</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: ".8125rem" }}>
                    {LADDER.map((s) => (
                      <tr key={s.rank}>
                        <td>
                          <StatusChip rank={s.rank} />
                        </td>
                        <td>
                          <Icon name="arrow-r" size="sm" style={{ color: "var(--ink-3)" }} />
                        </td>
                        <td>
                          {options.length > 0 ? (
                            <select
                              className="input"
                              name={`step-${s.rank}`}
                              aria-label={`Airtable option for ${s.name}`}
                              defaultValue={steps[String(s.rank)] ?? ""}
                              style={{ height: 34, fontSize: ".8125rem" }}
                            >
                              <option value="">— not mapped —</option>
                              {[
                                ...new Set([
                                  ...options,
                                  ...(steps[String(s.rank)] ? [steps[String(s.rank)]] : []),
                                ]),
                              ].map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="input"
                              name={`step-${s.rank}`}
                              aria-label={`Airtable option for ${s.name}`}
                              defaultValue={steps[String(s.rank)] ?? ""}
                              style={{ height: 34, fontSize: ".8125rem" }}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn btn--primary mt-4" type="submit">
                <Icon name="check" /> Save mapping
              </button>
            </form>

            {ignored.length > 0 && (
              <p className="t-quiet mt-4">
                Ignored: {ignored.join(", ")}. Records with those are left alone on both sides.
              </p>
            )}
            {options.length === 0 && config?.token && (
              <p className="hint">
                Airtable did not return the field&rsquo;s options. Check the token has schema access,
                or type the names by hand.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- the log */}
      <div className="sheet mt-4 only-desk">
        <div className="sheet-head wrap">
          <h2>Sync log</h2>
          <span className="sheet-note">
            If both sides changed, the later edit wins and the value it replaced is kept here. On an
            exact tie Tend wins. Nothing is merged, and no status is ever cleared.
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 150 }}>When</th>
                <th style={{ width: 200 }}>Direction</th>
                <th style={{ width: 190 }}>Person</th>
                <th>Change</th>
                <th style={{ width: 260 }}>Result</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: ".8125rem" }}>
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="t-quiet">
                    Nothing has synced yet.
                  </td>
                </tr>
              )}
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="t-quiet num">{when(e.at)}</td>
                  <td>
                    <Direction d={e.direction} />
                  </td>
                  <td>{e.person?.name ?? <span className="t-quiet">—</span>}</td>
                  <td>
                    {e.fromValue && e.toValue ? (
                      `${e.fromValue} → ${e.toValue}`
                    ) : e.toValue ? (
                      `→ “${e.toValue}”`
                    ) : e.fromValue ? (
                      `“${e.fromValue}” →`
                    ) : (
                      <span className="t-quiet">—</span>
                    )}
                  </td>
                  <td>
                    <Result result={e.result} />
                    {e.detail && <div className="t-quiet mt-2">{e.detail}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section className="m-sec only-mob mt-4">
        <span className="label">Sync log</span>
        <div className="m-sheet">
          {events.length === 0 && (
            <div className="m-row">
              <span className="t-quiet">Nothing has synced yet.</span>
            </div>
          )}
          {events.slice(0, 12).map((e) => (
            <div className="m-row" key={e.id}>
              <span className="grow">
                <b>{e.person?.name ?? (e.direction === "full" ? "Full sync" : "—")}</b>
                <br />
                <span
                  className="t-quiet"
                  style={{
                    color:
                      e.result === "skipped"
                        ? "var(--soon)"
                        : e.result === "conflict"
                          ? "var(--sky)"
                          : undefined,
                  }}
                >
                  {e.detail || [e.fromValue, e.toValue].filter(Boolean).join(" → ") || e.result}
                </span>
              </span>
              <span className="t-quiet num">{when(e.at)}</span>
            </div>
          ))}
        </div>
        <p className="t-quiet mt-3">
          If both sides changed, the later edit wins. On an exact tie Tend wins.
        </p>
      </section>
    </AppShell>
  );
}
