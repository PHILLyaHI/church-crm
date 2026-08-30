import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icons";
import { BandLegend, LadderMark, StatusChip } from "@/components/PersonBits";
import { LogContact } from "@/components/people/LogContact";
import { SundayBand, type SundayCell } from "@/components/people/SundayBand";
import { LadderPick, PersonPanels, ReminderToggle } from "@/components/people/PersonControls";
import { PersonSettings } from "@/components/people/PersonEdit";
import { db } from "@/lib/db";
import {
  DAY,
  ago,
  daysOverdue,
  fmtDate,
  fmtDay,
  recentSundays,
  sameDay,
  span,
  startOfDay,
  urgency,
} from "@/lib/dates";
import { accessToOwner, logAdminRead, requireViewer } from "@/lib/permissions";
import { INTERVAL_CHOICES, LADDER, PRIORITIES, meetingLabel, step } from "@/lib/status";
import {
  addNote,
  moveStatus,
  personCommand,
  saveInterval,
  savePriority,
  setRemindersPaused,
} from "./actions";
import "@/styles/people.css";

type NoteRow = {
  id: string;
  body: string;
  kind: string;
  fromRank: number | null;
  toRank: number | null;
  createdAt: Date;
  author: { name: string } | null;
};

type ContactRow = {
  id: string;
  kind: string;
  place: string | null;
  body: string | null;
  happenedOn: Date;
};

const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const atTime = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Everything that has happened to the record: moves, notes, what Tend did. */
function History({ notes }: { notes: NoteRow[] }) {
  if (notes.length === 0) {
    return (
      <p className="t-quiet">Nothing here yet. Moves up the ladder and anything you write land in this list.</p>
    );
  }
  return (
    <div className="tl">
      {notes.map((n) => (
        <div
          key={n.id}
          className={
            n.kind === "status_change"
              ? "tl-item is-status"
              : n.kind === "system"
                ? "tl-item is-sys"
                : "tl-item"
          }
        >
          <div className="tl-when">{fmtDay(n.createdAt)}</div>
          <p className="tl-body">
            {n.kind === "status_change" && (
              <b>
                {step(n.fromRank ?? 1).name} &rarr; {step(n.toRank ?? 1).name}.
              </b>
            )}
            {n.kind === "status_change" && n.body ? " " : null}
            {n.body}
          </p>
          <div className="tl-by">{n.author?.name ?? "Tend"}</div>
        </div>
      ))}
    </div>
  );
}

/** Every time you reached them: what it was, when, where, what was said. */
function ContactLog({ contacts }: { contacts: ContactRow[] }) {
  if (contacts.length === 0) return <p className="t-quiet">No contact logged yet.</p>;
  return (
    <div className="clog">
      {contacts.map((c) => (
        <div className="clog-item" key={c.id}>
          <span className="clog-kind">{meetingLabel(c.kind)}</span>
          <div className="clog-body">
            <div className="clog-when num">
              {fmtDay(c.happenedOn)} · {atTime(c.happenedOn)}
              {c.place ? ` · ${c.place}` : ""}
            </div>
            {c.body && <p className="clog-said">{c.body}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();

  // One round trip for the record and everything hanging off it, and the two
  // independent lookups run alongside it rather than after it. Reading the
  // person twice — once for the owner, once for the body — made the page wait
  // for two sequential queries before it could render anything.
  const [person, reminder, airtable] = await Promise.all([
    db.person.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true } },
        attendance: { select: { serviceDate: true, state: true } },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { name: true } } },
        },
        meetings: { orderBy: { happenedOn: "desc" } },
      },
    }),
    db.reminder.findFirst({
      where: { personId: id, sentAt: { not: null } },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
    db.airtableConfig.findUnique({ where: { id: "singleton" }, select: { enabled: true } }),
  ]);
  if (!person) notFound();

  const access = await accessToOwner(viewer, person.ownerId);
  if (!access.canRead) notFound();
  if (person.ownerId !== viewer.id) await logAdminRead(viewer, id, person.owner.name);

  const canWrite = access.canWrite;
  const first = person.name.split(" ")[0];
  const late = daysOverdue(person);
  const state = urgency(person);
  const due = new Date(
    startOfDay(person.lastContactAt ?? person.createdAt).getTime() + person.intervalDays * DAY,
  );

  const sundays = recentSundays(16);
  const present = (from: number) =>
    person.attendance.filter(
      (a) =>
        a.state === "present" &&
        sundays.slice(from).some((s) => sameDay(s, new Date(a.serviceDate))),
    ).length;
  const seen16 = present(0);
  const seen8 = present(8);

  /** Every Sunday in the band, each one answerable on its own. */
  const cells: SundayCell[] = sundays.map((s, i) => {
    const hit = person.attendance.find((a) => sameDay(new Date(a.serviceDate), s));
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      iso: `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`,
      label: s.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" }),
      state: hit?.state ?? null,
      isLast: i === sundays.length - 1,
    };
  });

  const intervals = INTERVAL_CHOICES.includes(person.intervalDays)
    ? INTERVAL_CHOICES
    : [...INTERVAL_CHOICES, person.intervalDays].sort((a, b) => a - b);

  const noEditing = (
    <span className="right">
      <span className="flag flag--read">
        <Icon name="lock" size="sm" /> No editing
      </span>
    </span>
  );

  const logContactButton = (
    <LogContact personId={person.id} name={person.name} className="btn btn--primary">
      <Icon name="check" /> Log contact
    </LogContact>
  );

  /* ---- the pieces both shells share ---- */

  const attendancePanel = (
    <>
      <div className="band-wrap">
        <SundayBand personId={person.id} name={person.name} sundays={cells} canWrite={canWrite} />
        <div className="band-scale">
          <span>{shortDate(sundays[0])}</span>
          <span>{shortDate(sundays[8])}</span>
          <span className="nowlab">{shortDate(sundays[15])} · last Sunday</span>
        </div>
      </div>
      <div className="mt-4">
        <BandLegend />
      </div>
      {canWrite && (
        <p className="when-note mt-3">Press any Sunday to say whether {first} was there.</p>
      )}
    </>
  );

  const noteBox = canWrite ? (
    <form className="note-box mb-4" action={addNote}>
      <input type="hidden" name="id" value={person.id} />
      <textarea
        className="input"
        name="body"
        rows={2}
        placeholder="Anything worth remembering about them."
        aria-label="Note"
        required
      />
      <div className="row mt-3">
        <button className="btn btn--ghost btn--sm push">Add to history</button>
      </div>
    </form>
  ) : null;

  const contactsPanel = (
    <>
      {canWrite && (
        <div className="mb-4">
          <LogContact personId={person.id} name={person.name} className="btn btn--ghost btn--wide">
            <Icon name="plus" size="sm" /> Log a contact
          </LogContact>
        </div>
      )}
      <ContactLog contacts={person.meetings} />
    </>
  );

  const intervalPicker = canWrite ? (
    <form className="interval mt-2" action={saveInterval}>
      <input type="hidden" name="id" value={person.id} />
      {intervals.map((d) => (
        <button
          key={d}
          className="fchip"
          name="days"
          value={d}
          aria-pressed={d === person.intervalDays}
        >
          {span(d)}
        </button>
      ))}
    </form>
  ) : (
    <div className="interval mt-2 ro-mask">
      {intervals.map((d) => (
        <button key={d} className="fchip" disabled aria-pressed={d === person.intervalDays}>
          {span(d)}
        </button>
      ))}
    </div>
  );

  const priorityPicker = canWrite ? (
    <form className="seg" style={{ width: "100%" }} action={savePriority}>
      <input type="hidden" name="id" value={person.id} />
      {PRIORITIES.map((p) => (
        <button
          key={p.value}
          name="priority"
          value={p.value}
          aria-pressed={person.priority === p.value}
          style={{ flex: 1, justifyContent: "center" }}
        >
          {p.label}
        </button>
      ))}
    </form>
  ) : (
    <div className="seg ro-mask" style={{ width: "100%" }}>
      {PRIORITIES.map((p) => (
        <button
          key={p.value}
          disabled
          aria-pressed={person.priority === p.value}
          style={{ flex: 1, justifyContent: "center" }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  /* ---- the three cards that now live behind the three dots ---- */

  const followUpContent = (
    <>
      <span className="label">Contact every</span>
      {intervalPicker}
      <div className="divider" />
      <dl className="kv">
        <dt>Last contact</dt>
        <dd className="num">{person.lastContactAt ? fmtDay(person.lastContactAt) : "Never"}</dd>
        <dt>{state === "over" ? "Was due" : "Due"}</dt>
        <dd
          className="num"
          style={state === "over" ? { color: "var(--over)", fontWeight: 640 } : undefined}
        >
          {fmtDay(due)}
        </dd>
        {reminder?.sentAt && (
          <>
            <dt>Reminder sent</dt>
            <dd className="num">{ago(reminder.sentAt)}</dd>
          </>
        )}
      </dl>
    </>
  );

  const reminderToggleEl = canWrite ? (
    <ReminderToggle paused={person.remindersPaused} action={setRemindersPaused.bind(null, person.id)} />
  ) : null;

  const detailsContent = (
    <dl className="kv">
      <dt>Phone</dt>
      <dd className="num">{person.phone ? <a href={`tel:${person.phone}`}>{person.phone}</a> : "—"}</dd>
      <dt>Email</dt>
      <dd>{person.email ? <a href={`mailto:${person.email}`}>{person.email}</a> : "—"}</dd>
      <dt>Added</dt>
      <dd className="num">{fmtDate(person.createdAt)}</dd>
      {!canWrite && (
        <>
          <dt>Carried by</dt>
          <dd>{person.owner.name}</dd>
        </>
      )}
    </dl>
  );

  return (
    <AppShell
      viewer={viewer}
      current="people"
      crumb={
        <>
          <Link href="/people">People</Link>
          <Icon name="chev" size="sm" style={{ stroke: "var(--rule-2)" }} />
          <b>{person.name}</b>
        </>
      }
      title={person.name}
      actions={
        <div className="row gap-sm">
          {canWrite && logContactButton}
          <PersonSettings
            person={{
              id: person.id,
              name: person.name,
              phone: person.phone,
              email: person.email,
            }}
            canWrite={canWrite}
            paused={person.remindersPaused}
            personAction={personCommand}
            followUp={followUpContent}
            priority={priorityPicker}
            details={detailsContent}
            reminderToggle={reminderToggleEl}
          />
        </div>
      }
      thumb={canWrite ? logContactButton : undefined}
    >
      <div className="plot-page">
        {!canWrite && (
          <div className="banner banner--read">
            <Icon name="eye" />
            <span>
              <b>{access.borrowedFrom}&rsquo;s list.</b> You can read this record. Only{" "}
              {access.borrowedFrom?.split(" ")[0]} can change it.
            </span>
          </div>
        )}

        {state === "over" && (
          <div className={canWrite ? "banner banner--over" : "banner banner--over mt-3"}>
            <Icon name="clock" />
            <span>
              <b>Overdue by {span(late)}.</b>{" "}
              {person.lastContactAt
                ? `You last spoke on ${fmtDay(person.lastContactAt)}.`
                : "You have not spoken yet."}{" "}
              Their interval is {span(person.intervalDays)}.
            </span>
            {canWrite && (
              <span className="right">
                <form action={personCommand}>
                  <input type="hidden" name="id" value={person.id} />
                  <button className="btn btn--ghost btn--sm" name="do" value="snooze7">
                    <Icon name="clock" size="sm" /> Snooze a week
                  </button>
                </form>
              </span>
            )}
          </div>
        )}

        {/* ===================== DESKTOP =====================
            One column, centered: the person, and everything that has passed
            between you. Follow up, Priority and Details moved behind the
            three dots above — settings about them, not about what happened. */}
        <div className="one-col mt-4 only-desk">
          <section className="sheet rise rise-1">
            <div className="sheet-head">
              <h2>Where {first} is</h2>
              <span className="sheet-note num">Moved {fmtDate(person.statusChangedAt)}</span>
              {canWrite ? (
                airtable?.enabled ? (
                  <span className="right">
                    <span className="flag flag--read">
                      <Icon name="sync" size="sm" /> Syncs with Airtable
                    </span>
                  </span>
                ) : null
              ) : (
                noEditing
              )}
            </div>
            <div className="sheet-body">
              {canWrite ? (
                <LadderPick rank={person.statusRank} action={moveStatus.bind(null, person.id)} />
              ) : (
                <div className="ladder-pick ro-mask">
                  {LADDER.map((s) => (
                    <button
                      key={s.rank}
                      disabled
                      aria-pressed={s.rank === person.statusRank}
                      className={s.rank < person.statusRank ? "done" : undefined}
                    >
                      <span className="rk num">{s.rank}</span>
                      <span className="nm">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="ladder-rail" />
              {canWrite && (
                <p className="when-note mt-3">
                  Press any step to move {first} — forward or back.
                </p>
              )}
            </div>
          </section>

          <section className="sheet rise rise-2">
            <div className="sheet-head">
              <h2>Sundays</h2>
              <span className="sheet-note num">
                {seen16} of the last 16 · {seen8} of the last 8
              </span>
            </div>
            <div className="sheet-body">{attendancePanel}</div>
          </section>

          <section className="sheet rise rise-3">
            <div className="sheet-head">
              <h2>Contacts</h2>
              <span className="sheet-note num">{person.meetings.length} logged</span>
              {!canWrite && noEditing}
            </div>
            <div className="sheet-body">{contactsPanel}</div>
          </section>

          <section className="sheet rise rise-4">
            <div className="sheet-head">
              <h2>History</h2>
              <span className="sheet-note num">
                {person.notes.length} {person.notes.length === 1 ? "entry" : "entries"}
              </span>
              {!canWrite && noEditing}
            </div>
            <div className="sheet-body">
              {noteBox}
              <History notes={person.notes} />
            </div>
          </section>
        </div>

        {/* ====================== PHONE ====================== */}
        <div className="only-mob mt-4">
          <section className="m-sheet mb-4 rise">
            <div
              className="m-row"
              style={{ alignItems: "flex-start", flexDirection: "column", gap: 12 }}
            >
              <div className="row" style={{ width: "100%" }}>
                <span className="label">Where they are</span>
                <span className="push">
                  <StatusChip rank={person.statusRank} short />
                </span>
              </div>
              <div className="band-wrap" style={{ width: "100%" }}>
                <LadderMark rank={person.statusRank} large fill />
                <div className="band-scale">
                  <span>1 Not a believer</span>
                  <span>8 Leads</span>
                </div>
              </div>
              {/* One control, both directions. People move back down the ladder
                  as often as they move up, and a second full-width button for
                  the way down would have implied it was the rarer thing. */}
              {canWrite && (
                <div className="stepper">
                  <form action={moveStatus.bind(null, person.id, person.statusRank - 1)}>
                    <button
                      className="stepper-btn"
                      disabled={person.statusRank <= 1}
                      aria-label={
                        person.statusRank > 1
                          ? `Move down to ${step(person.statusRank - 1).name}`
                          : "Already at the first step"
                      }
                    >
                      <Icon name="minus" />
                    </button>
                  </form>
                  <span className="stepper-now">
                    <b>{step(person.statusRank).name}</b>
                    <span className="t-quiet num">Step {person.statusRank} of 8</span>
                  </span>
                  <form action={moveStatus.bind(null, person.id, person.statusRank + 1)}>
                    <button
                      className="stepper-btn"
                      disabled={person.statusRank >= 8}
                      aria-label={
                        person.statusRank < 8
                          ? `Move up to ${step(person.statusRank + 1).name}`
                          : "Already at the last step"
                      }
                    >
                      <Icon name="plus" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </section>

          <PersonPanels
            contacts={
              <div className="m-sheet">
                <div className="m-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  {contactsPanel}
                </div>
              </div>
            }
            history={
              <div className="m-sheet">
                <div className="m-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  {noteBox}
                  <History notes={person.notes} />
                </div>
              </div>
            }
            sundays={
              <div className="m-sheet">
                <div
                  className="m-row"
                  style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}
                >
                  {attendancePanel}
                  <p className="t-quiet" style={{ fontSize: ".8125rem" }}>
                    {seen16} of the last 16 Sundays. {seen8} of the last 8.
                  </p>
                </div>
              </div>
            }
          />

          <section className="m-sec mt-5">
            <span className="label">Follow up</span>
            <div className="m-sheet">
              <div
                className="m-row"
                style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}
              >
                <span className="label">Contact every</span>
                {intervalPicker}
              </div>
              <div className="m-row">
                <span className="grow">{state === "over" ? "Was due" : "Due"}</span>
                <b className="num" style={state === "over" ? { color: "var(--over)" } : undefined}>
                  {fmtDay(due)}
                </b>
              </div>
              {canWrite && (
                <div className="m-row">
                  <span className="grow">Email me when they are overdue</span>
                  <ReminderToggle
                    paused={person.remindersPaused}
                    action={setRemindersPaused.bind(null, person.id)}
                    large
                  />
                </div>
              )}
            </div>
          </section>

          <section className="m-sec">
            <span className="label">Priority</span>
            <div className="m-sheet">
              <div className="m-row">{priorityPicker}</div>
            </div>
          </section>

          <section className="m-sec">
            <span className="label">Details</span>
            <div className="m-sheet">
              <div className="m-row">
                <span className="grow">Phone</span>
                {person.phone ? (
                  <a className="num" href={`tel:${person.phone}`}>
                    {person.phone}
                  </a>
                ) : (
                  <span className="t-quiet">—</span>
                )}
              </div>
              <div className="m-row">
                <span className="grow">Email</span>
                {person.email ? (
                  <a href={`mailto:${person.email}`}>{person.email}</a>
                ) : (
                  <span className="t-quiet">—</span>
                )}
              </div>
              <div className="m-row">
                <span className="grow">Added</span>
                <span className="num">{fmtDate(person.createdAt)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
