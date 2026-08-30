import { LADDER, step, chipClass, priClass, priLabel } from "@/lib/status";
import { daysOverdue, urgency, recentSundays, sameDay, span } from "@/lib/dates";
import { Icon } from "@/components/Icons";

type Att = { serviceDate: Date; state: string };

/**
 * The season band: one cell per Sunday, oldest left. It never wraps — it
 * scales. Filled is present, hatched is away, outlined is this week.
 */
export function SeasonBand({
  attendance,
  weeks = 16,
  size,
}: {
  attendance: Att[];
  weeks?: number;
  size?: "sm" | "lg";
}) {
  const sundays = recentSundays(weeks);
  const cls = size === "sm" ? "band band--sm" : size === "lg" ? "band band--lg" : "band";
  const last = sundays.length - 1;
  return (
    <span className={cls} role="img" aria-label={`${attendance.filter((a) => a.state === "present").length} of the last ${weeks} Sundays`}>
      {sundays.map((s, i) => {
        const hit = attendance.find((a) => sameDay(new Date(a.serviceDate), s));
        const marks = [
          hit?.state === "present" ? "on" : "",
          hit?.state === "away" ? "away" : "",
          i === last ? "now" : "",
        ].filter(Boolean);
        return <i key={s.toISOString()} className={marks.join(" ")} />;
      })}
    </span>
  );
}

export function BandLegend() {
  return (
    <div className="band-legend">
      <span><i style={{ background: "var(--plot)" }} /> Present</span>
      <span><i style={{ background: "repeating-linear-gradient(45deg,var(--rule-2) 0 2px,transparent 2px 4px)", boxShadow: "inset 0 0 0 1px var(--rule-2)" }} /> Away</span>
      <span><i style={{ background: "var(--rule)" }} /> Not there</span>
    </div>
  );
}

/** Eight steps, position encoded by height — never by colour alone. */
export function LadderMark({ rank, large, fill }: { rank: number; large?: boolean; fill?: boolean }) {
  const cls = ["ladder", large ? "ladder--lg" : "", fill ? "ladder--fill" : ""].filter(Boolean).join(" ");
  return (
    <span className={cls} role="img" aria-label={`Step ${rank} of 8: ${step(rank).name}`}>
      {LADDER.map((s) => (
        <i key={s.rank} className={s.rank <= rank ? "on" : undefined} />
      ))}
    </span>
  );
}

/** Rank numeral plus name. Three tints, not eight. */
export function StatusChip({ rank, short }: { rank: number; short?: boolean }) {
  const s = step(rank);
  return (
    <span className={chipClass(rank)}>
      <b className="num">{s.rank}</b>
      {short ? s.short : s.name}
    </span>
  );
}

export function PriorityMark({ priority }: { priority: string }) {
  return (
    <span className={priClass(priority)}>
      <em>
        <i />
        <i />
        <i />
      </em>
      {priLabel(priority)}
    </span>
  );
}

type DueSource = {
  lastContactAt: Date | null;
  intervalDays: number;
  createdAt: Date;
  snoozedUntil: Date | null;
  remindersPaused: boolean;
};

/** Overdue is the only alarm. Everything else stays quiet. */
export function DueFlag({ person }: { person: DueSource }) {
  const u = urgency(person);
  const d = daysOverdue(person);

  if (person.remindersPaused) {
    return (
      <span className="flag flag--ok">
        <Icon name="pause" size="sm" /> Paused
      </span>
    );
  }
  if (person.snoozedUntil && person.snoozedUntil > new Date()) {
    return (
      <span className="flag flag--ok">
        <Icon name="clock" size="sm" /> Snoozed
      </span>
    );
  }
  if (u === "over") {
    return (
      <span className="flag flag--over">
        <Icon name="clock" size="sm" /> {span(d)} over
      </span>
    );
  }
  // d === 0 is the day itself, and "Due in 0 days" is not how anyone says that.
  if (u === "soon") {
    return <span className="flag flag--soon">{d === 0 ? "Due today" : `Due in ${span(Math.abs(d))}`}</span>;
  }
  return <span className="flag flag--ok">{d === 0 ? "Due today" : `In ${span(Math.abs(d))}`}</span>;
}

/** The key, published where it is used. */
export function ColourKey() {
  return (
    <div className="key">
      <span><i style={{ background: "var(--plot)" }} /> Yours</span>
      <span><i style={{ background: "var(--over)" }} /> Overdue</span>
      <span><i style={{ background: "var(--soon)" }} /> Due soon</span>
      <span><i style={{ background: "var(--sky)" }} /> Read-only</span>
    </div>
  );
}

/** Where a leader's people sit across the eight steps. */
export function Spread({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <>
      <div className="spread" role="img" aria-label="People at each step">
        {counts.map((c, i) => (
          <i key={i} style={{ height: `${Math.max(2, (c / max) * 34)}px` }} />
        ))}
      </div>
      <div className="spread-scale">
        <span>1 Not a believer</span>
        <span>8 Leads</span>
      </div>
    </>
  );
}
