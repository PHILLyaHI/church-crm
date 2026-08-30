"use client";

import Papa from "papaparse";
import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icons";
import { Select } from "@/components/Select";
import { AlertGlyph } from "@/components/admin/Glyphs";
import { INTERVAL_CHOICES, LADDER, PRIORITIES } from "@/lib/status";
import { span } from "@/lib/dates";
import { addOnePerson, importCsv, type OneResult } from "@/app/add/actions";

const MAX_ROWS = 500;

type Target = "name" | "phone" | "email" | "status" | "note" | "skip";

const TARGETS: { value: Target; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "status", label: "Status" },
  { value: "note", label: "First note" },
  { value: "skip", label: "Skip this column" },
];

const norm = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Header guesses. First column that fits a slot takes it; the rest skip. */
const HEADER_HINTS: { target: Target; test: RegExp }[] = [
  { target: "email", test: /\b(email|e mail)\b/ },
  { target: "phone", test: /\b(phone|mobile|cell|tel|telephone|number)\b/ },
  { target: "name", test: /\b(name|person|who)\b/ },
  { target: "status", test: /\b(status|stage|step|where|journey|walk|faith|ladder)\b/ },
  { target: "note", test: /\b(note|notes|comment|comments|about|detail|details|met|background)\b/ },
];

function guessMapping(headers: string[]): Target[] {
  const used = new Set<Target>();
  return headers.map((h) => {
    const v = norm(h);
    for (const hint of HEADER_HINTS) {
      if (!used.has(hint.target) && hint.test.test(v)) {
        used.add(hint.target);
        return hint.target;
      }
    }
    return "skip" as Target;
  });
}

/** The words a church actually writes in a spreadsheet, per step. */
const STEP_WORDS: [number, string][] = [
  [1, "not a believer"], [1, "not believer"], [1, "unbeliever"], [1, "not yet"], [1, "no faith"],
  [1, "not christian"], [1, "new"], [1, "none"],
  [2, "seeking"], [2, "curious"], [2, "interested"], [2, "exploring"], [2, "searching"],
  [2, "asking"], [2, "open"],
  [3, "visited church"], [3, "visited"], [3, "visitor"], [3, "came once"], [3, "been once"],
  [3, "first visit"], [3, "guest"],
  [4, "attends sometimes"], [4, "comes sometimes"], [4, "sometimes"], [4, "occasional"],
  [4, "occasionally"], [4, "now and then"], [4, "on and off"], [4, "irregular"],
  [5, "attends regularly"], [5, "comes regularly"], [5, "regularly"], [5, "regular"],
  [5, "every week"], [5, "weekly"], [5, "member"], [5, "committed"],
  [6, "believer"], [6, "christian"], [6, "saved"], [6, "converted"], [6, "baptised"],
  [6, "baptized"], [6, "follower"],
  [7, "serves"], [7, "serving"], [7, "volunteer"], [7, "volunteers"], [7, "on a team"],
  [7, "helps"], [7, "ministry"],
  [8, "leads"], [8, "leading"], [8, "leader"], [8, "runs a group"], [8, "group leader"],
  [8, "elder"], [8, "pastor"],
];

/** A value from the file to a step, or null — which is a question, not a guess. */
function guessRank(raw: string): number | null {
  const v = norm(raw);
  if (!v) return null;

  const digit = v.match(/^([1-8])(\s|$)/);
  if (digit) return Number(digit[1]);

  for (const s of LADDER) {
    if (v === norm(s.name) || v === norm(s.short)) return s.rank;
  }
  for (const [rank, word] of STEP_WORDS) {
    if (v === word) return rank;
  }
  // Longest phrase wins, so "not a believer" never reads as "believer".
  let best: { rank: number; len: number } | null = null;
  for (const [rank, word] of STEP_WORDS) {
    if (v.includes(word) && (!best || word.length > best.len)) best = { rank, len: word.length };
  }
  return best ? best.rank : null;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readable(list: string[]) {
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  const shown = list.slice(0, 3).join(", ");
  return list.length > 3 ? `${shown} and ${list.length - 3} more` : `${shown} and ${list[list.length - 1]}`;
}

type Staged = { name: string; size: number; total: number };
type Row = { name: string; phone?: string; email?: string; statusRank: number; note?: string };

export function AddPeople({
  existingNames,
  defaultInterval,
  initialTab = "one",
}: {
  existingNames: string[];
  defaultInterval: number;
  /** /add?tab=csv arrives from anywhere that offers "import a CSV". */
  initialTab?: "one" | "csv";
}) {
  const [tab, setTab] = useState<"one" | "csv">(initialTab);

  // --- one person -------------------------------------------------------
  const [one, oneAction] = useActionState<OneResult, FormData>(addOnePerson, { ok: false });
  const [priority, setPriority] = useState("medium");
  // The two pickers post through hidden fields, so the form stays a plain
  // server action while the controls keep the system's own chrome.
  const [oneRank, setOneRank] = useState(2);
  const [oneInterval, setOneInterval] = useState(defaultInterval);

  // --- the file ---------------------------------------------------------
  const [file, setFile] = useState<Staged | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Target[]>([]);
  const [choice, setChoice] = useState<Record<string, number>>({});
  const [batchInterval, setBatchInterval] = useState(defaultInterval);
  const [batchPriority, setBatchPriority] = useState("medium");
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const picker = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function clear() {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping([]);
    setChoice({});
    setProblem(null);
    if (picker.current) picker.current.value = "";
  }

  function read(f: File) {
    setProblem(null);
    Papa.parse<string[], File>(f, {
      skipEmptyLines: "greedy",
      complete: (result) => {
        const all = (result.data as string[][]).filter((r) =>
          r.some((c) => String(c ?? "").trim() !== ""),
        );
        if (all.length < 2) {
          clear();
          setProblem("That file has a header row and nothing under it.");
          return;
        }
        const head = all[0].map((h, i) => String(h ?? "").trim() || `Column ${i + 1}`);
        const body = all.slice(1).map((r) => head.map((_, i) => String(r[i] ?? "").trim()));
        setFile({ name: f.name, size: f.size, total: body.length });
        setHeaders(head);
        setRows(body.slice(0, MAX_ROWS));
        setMapping(guessMapping(head));
        setChoice({});
      },
      error: () => {
        clear();
        setProblem("That file could not be read as a CSV.");
      },
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) read(f);
  }

  const nameCol = mapping.indexOf("name");
  const statusCol = mapping.indexOf("status");

  /** Every distinct status value in the file, in the order it first appears. */
  const values = useMemo(() => {
    if (statusCol < 0) return [] as { raw: string; key: string; rank: number | null; count: number }[];
    const seen = new Map<string, { raw: string; key: string; rank: number | null; count: number }>();
    for (const r of rows) {
      const raw = (r[statusCol] ?? "").trim();
      if (!raw) continue;
      const key = norm(raw);
      const hit = seen.get(key);
      if (hit) hit.count++;
      else seen.set(key, { raw, key, rank: guessRank(raw), count: 1 });
    }
    return [...seen.values()];
  }, [rows, statusCol]);

  const known = useMemo(() => values.filter((v) => v.rank !== null), [values]);
  const unknown = useMemo(() => values.filter((v) => v.rank === null), [values]);

  /** Nothing here is written. It is the sentence under the button. */
  const plan = useMemo(() => {
    const mine = new Set(existingNames.map((n) => n.trim().toLowerCase()));
    const inFile = new Set<string>();
    const keep: Row[] = [];
    const dupes: string[] = [];
    const repeats: string[] = [];
    let leftOut = 0;
    let nameless = 0;

    if (nameCol < 0) return { keep, dupes, repeats, leftOut, nameless };

    const phoneCol = mapping.indexOf("phone");
    const emailCol = mapping.indexOf("email");
    const noteCol = mapping.indexOf("note");

    for (const r of rows) {
      const name = (r[nameCol] ?? "").trim();
      if (!name) {
        nameless++;
        continue;
      }
      const key = name.toLowerCase();
      if (mine.has(key)) {
        dupes.push(name);
        continue;
      }
      if (inFile.has(key)) {
        repeats.push(name);
        continue;
      }

      let rank = 1;
      if (statusCol >= 0) {
        const raw = (r[statusCol] ?? "").trim();
        if (raw) {
          const found = values.find((v) => v.key === norm(raw));
          if (found?.rank) rank = found.rank;
          else {
            const picked = choice[norm(raw)] ?? 2;
            if (picked === 0) {
              leftOut++;
              continue;
            }
            rank = picked;
          }
        }
      }

      inFile.add(key);
      keep.push({
        name,
        phone: phoneCol >= 0 ? (r[phoneCol] || undefined) : undefined,
        email: emailCol >= 0 ? (r[emailCol] || undefined) : undefined,
        statusRank: rank,
        note: noteCol >= 0 ? (r[noteCol] || undefined) : undefined,
      });
    }
    return { keep, dupes, repeats, leftOut, nameless };
  }, [rows, mapping, nameCol, statusCol, values, choice, existingNames]);

  const willSkip = plan.dupes.length + plan.repeats.length + plan.leftOut + plan.nameless;
  const canApply = Boolean(file) && nameCol >= 0 && plan.keep.length > 0 && !pending;

  function apply() {
    if (!file || !canApply) return;
    setProblem(null);
    start(async () => {
      const result = await importCsv({
        filename: file.name,
        intervalDays: batchInterval,
        priority: batchPriority,
        rows: plan.keep,
      });
      if (result.ok) router.push(`/people?imported=${result.batchId}`);
      else setProblem(result.error);
    });
  }

  const applyLabel = plan.keep.length === 1 ? "Add 1 person" : `Add ${plan.keep.length} people`;

  return (
    <>
      <div className="seg mb-4 only-mob" style={{ width: "100%" }}>
        <button
          type="button"
          aria-pressed={tab === "one"}
          style={{ flex: 1, justifyContent: "center", height: 38 }}
          onClick={() => setTab("one")}
        >
          One person
        </button>
        <button
          type="button"
          aria-pressed={tab === "csv"}
          style={{ flex: 1, justifyContent: "center", height: 38 }}
          onClick={() => setTab("csv")}
        >
          From a CSV
        </button>
      </div>

      <div className="add-grid">
        {/* ---------------------------------------------------- one person */}
        <section className="sheet" data-active={tab === "one"}>
          <div className="sheet-head">
            <h2>One person</h2>
          </div>
          <div className="sheet-body">
            {one.ok && (
              <div className="banner banner--ok mb-4">
                <Icon name="check" />
                <span>
                  <b>{one.added}</b> is on your list.
                </span>
              </div>
            )}
            {one.error && (
              <div className="banner banner--warn mb-4">
                <AlertGlyph />
                <span>{one.error}</span>
              </div>
            )}

            <form action={oneAction} key={one.ok ? `done-${one.added}` : "new"}>
              <input type="hidden" name="priority" value={priority} />
              <label className="field">
                <span className="label">Name</span>
                <input className="input" name="name" placeholder="Aisha Rahman" required />
              </label>

              <input type="hidden" name="statusRank" value={oneRank} />
              <input type="hidden" name="intervalDays" value={oneInterval} />
              <div className="grid-2">
                <div className="field">
                  <span className="label" style={{ display: "block", marginBottom: 6 }}>
                    Where they are
                  </span>
                  <Select
                    label="Where they are"
                    value={String(oneRank)}
                    block
                    choices={LADDER.map((s) => ({ value: String(s.rank), label: `${s.rank} · ${s.name}` }))}
                    onChange={(v) => setOneRank(Number(v))}
                  />
                </div>
                <div className="field">
                  <span className="label" style={{ display: "block", marginBottom: 6 }}>
                    Contact every
                  </span>
                  <Select
                    label="Contact every"
                    value={String(oneInterval)}
                    block
                    choices={INTERVAL_CHOICES.map((d) => ({ value: String(d), label: span(d) }))}
                    onChange={(v) => setOneInterval(Number(v))}
                  />
                </div>
              </div>

              <div className="field">
                <span className="label" style={{ display: "block", marginBottom: 6 }}>
                  Priority
                </span>
                <div className="seg" style={{ width: "100%" }}>
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      aria-pressed={priority === p.value}
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => setPriority(p.value)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="field">
                <span className="label">
                  Phone{" "}
                  <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
                    — optional
                  </span>
                </span>
                <input className="input" name="phone" placeholder="07700 900142" />
              </label>

              <label className="field">
                <span className="label">
                  Email{" "}
                  <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
                    — optional
                  </span>
                </span>
                <input className="input" name="email" placeholder="aisha@example.com" />
              </label>

              <label className="field">
                <span className="label">First note</span>
                <textarea
                  className="input"
                  name="note"
                  rows={2}
                  placeholder="Where you met, what you talked about"
                />
              </label>

              <button className="btn btn--primary btn--wide" type="submit">
                <Icon name="plus" /> Add to my people
              </button>
            </form>
          </div>
        </section>

        {/* --------------------------------------------------- a whole list */}
        <section className="sheet" data-active={tab === "csv"}>
          <div className="sheet-head">
            <h2>A whole list</h2>
            <span className="sheet-note">CSV, up to {MAX_ROWS} rows</span>
          </div>
          <div className="sheet-body">
            <div
              className={over ? "drop is-over" : "drop"}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
            >
              <Icon name="upload" size="lg" />
              <h3>Drop a CSV here</h3>
              <p>Or drop one straight onto your people list.</p>
              <button className="btn btn--ghost mt-4" type="button" onClick={() => picker.current?.click()}>
                Choose a file
              </button>
              <input
                ref={picker}
                type="file"
                accept=".csv,text/csv"
                className="sr"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) read(f);
                }}
              />
            </div>

            {problem && (
              <div className="banner banner--warn mt-4">
                <AlertGlyph />
                <span>{problem}</span>
              </div>
            )}

            <dl className="kv mt-4">
              <dt>Needs</dt>
              <dd className="left">One column of names</dd>
              <dt>Reads if present</dt>
              <dd className="left">Status, phone, email, notes</dd>
              <dt>Duplicates</dt>
              <dd className="left">Matched on name, then skipped</dd>
            </dl>
            <p className="t-quiet mt-4">Everyone in a CSV comes in as yours. Nobody else sees them.</p>
          </div>
        </section>

        {/* ------------------------------------------------ check the columns */}
        {file && (
          <section className="sheet add-span" data-active={tab === "csv"}>
            <div className="sheet-head wrap">
              <h2>Check the columns</h2>
              <span className="right filecard-slot">
                <span className="filecard">
                  <Icon name="file" style={{ color: "var(--plot)" }} />
                  <span>
                    <span className="fn">{file.name}</span>
                    <br />
                    <span className="t-quiet num">
                      {rows.length} rows · {headers.length} columns · {fmtSize(file.size)}
                    </span>
                  </span>
                  <button
                    className="icon-btn"
                    style={{ width: 28, height: 28 }}
                    aria-label="Remove file"
                    type="button"
                    onClick={clear}
                  >
                    <Icon name="x" size="sm" />
                  </button>
                </span>
              </span>
            </div>

            <div className="sheet-body">
              {file.total > MAX_ROWS && (
                <div className="banner banner--warn mb-4">
                  <AlertGlyph />
                  <span>
                    <b>That file has {file.total} rows.</b> The first {MAX_ROWS} are read.
                  </span>
                </div>
              )}

              <div
                className="maprow only-desk"
                style={{ borderBottom: "1px solid var(--rule-2)", paddingBottom: 8 }}
              >
                <span className="label">In your file</span>
                <span />
                <span className="label">In Tend</span>
              </div>

              {headers.map((h, i) => (
                <div className={mapping[i] === "skip" ? "maprow is-skip" : "maprow"} key={`${h}-${i}`}>
                  <div className="mapcol">
                    <div className="csvname">
                      <code>{h}</code>
                    </div>
                    <div className="map-sample mt-2">
                      <span>
                        {rows
                          .slice(0, 3)
                          .map((r) => r[i])
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </div>
                  </div>
                  <span className="map-arrow">
                    <Icon name="arrow-r" />
                  </span>
                  <div className="mapcol">
                    <Select
                      label={`What ${h} is in Tend`}
                      value={mapping[i]}
                      block
                      choices={TARGETS.map((t) => ({ value: t.value, label: t.label }))}
                      onChange={(v) => {
                        const next = v as Target;
                        setMapping((m) =>
                          m.map((t, j) =>
                            j === i ? next : next !== "skip" && t === next ? "skip" : t,
                          ),
                        );
                      }}
                    />

                    {mapping[i] === "status" && known.length > 0 && (
                      <div className="valmap mt-3">
                        {known.map((v) => (
                          <span key={v.key}>
                            <code>{v.raw}</code> →{" "}
                            <b>
                              {v.rank} {LADDER[(v.rank ?? 1) - 1].name}
                            </b>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {nameCol < 0 && (
                <div className="banner banner--warn mt-4">
                  <AlertGlyph />
                  <span>
                    <b>No column is the name.</b> Pick one — it is the only thing this needs.
                  </span>
                </div>
              )}

              {unknown.map((v) => (
                <div className="banner banner--warn mt-4" key={v.key}>
                  <AlertGlyph />
                  <span>
                    <b>
                      {v.count} {v.count === 1 ? "row says" : "rows say"} “{v.raw}”.
                    </b>{" "}
                    That isn&rsquo;t one of the eight steps.
                  </span>
                  <span className="right">
                    <Select
                      label={`What “${v.raw}” means`}
                      value={String(choice[v.key] ?? 2)}
                      width={218}
                      choices={[
                        ...LADDER.map((s) => ({
                          value: String(s.rank),
                          label: `Set them to ${s.rank} ${s.name}`,
                        })),
                        { value: "0", label: "Leave those rows out" },
                      ]}
                      onChange={(val) => setChoice((c) => ({ ...c, [v.key]: Number(val) }))}
                    />
                  </span>
                </div>
              ))}

              {plan.dupes.length > 0 && (
                <div className="banner banner--read mt-3">
                  <AlertGlyph />
                  <span>
                    <b>
                      {plan.dupes.length} {plan.dupes.length === 1 ? "is" : "are"} already yours
                    </b>{" "}
                    — {readable(plan.dupes)}. They&rsquo;ll be skipped.
                  </span>
                </div>
              )}

              {plan.repeats.length > 0 && (
                <div className="banner banner--read mt-3">
                  <AlertGlyph />
                  <span>
                    <b>
                      {readable([...new Set(plan.repeats)])}{" "}
                      {new Set(plan.repeats).size === 1 ? "appears" : "appear"} more than once
                    </b>{" "}
                    in this file. The first row is the one that comes in.
                  </span>
                </div>
              )}

              <div className="divider" />

              <div className="row wrap">
                <label className="row gap-sm" style={{ fontSize: ".8125rem" }}>
                  <span className="label">Contact everyone every</span>
                  <Select
                    label="Contact everyone every"
                    value={String(batchInterval)}
                    width={148}
                    align="right"
                    choices={INTERVAL_CHOICES.map((d) => ({ value: String(d), label: span(d) }))}
                    onChange={(v) => setBatchInterval(Number(v))}
                  />
                </label>
                <label className="row gap-sm" style={{ fontSize: ".8125rem" }}>
                  <span className="label">Priority</span>
                  <Select
                    label="Priority"
                    value={batchPriority}
                    width={148}
                    align="right"
                    choices={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
                    onChange={setBatchPriority}
                  />
                </label>
                <span className="push row gap-sm">
                  <span className="t-quiet">
                    <b className="num">{plan.keep.length}</b> will be added ·{" "}
                    <span className="num">{willSkip}</span> skipped
                  </span>
                  <button className="btn btn--quiet" type="button" onClick={clear}>
                    Cancel
                  </button>
                  <button
                    className="btn btn--primary"
                    type="button"
                    onClick={apply}
                    disabled={!canApply}
                    data-pending={pending ? "true" : undefined}
                  >
                    <Icon name="check" /> {pending ? "Adding…" : applyLabel}
                  </button>
                </span>
              </div>
            </div>
          </section>
        )}
      </div>

      {file && tab === "csv" && (
        <div className="m-thumb only-mob">
          <button
            className="btn btn--primary"
            type="button"
            onClick={apply}
            disabled={!canApply}
            data-pending={pending ? "true" : undefined}
          >
            <Icon name="check" /> {pending ? "Adding…" : applyLabel}
          </button>
        </div>
      )}
    </>
  );
}
