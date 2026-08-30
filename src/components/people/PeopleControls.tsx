"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/Select";
import { LADDER } from "@/lib/status";
import { BANDS, SORTS, type Counts, type View } from "./view";

/** Every control writes the view back to the URL; the server does the filtering. */
function useGo(view: View) {
  const router = useRouter();
  return (patch: Partial<View>) => {
    const next = { ...view, ...patch };
    const q = new URLSearchParams();
    if (next.f && next.f !== "all") q.set("f", next.f);
    if (next.s) q.set("s", next.s);
    if (next.sort && next.sort !== "over") q.set("sort", next.sort);
    const qs = q.toString();
    router.replace(qs ? `/people?${qs}` : "/people", { scroll: false });
  };
}

const STATUS_CHOICES = [
  { value: "", label: "Any status" },
  ...LADDER.map((s) => ({ value: String(s.rank), label: `${s.rank} · ${s.name}` })),
];

const SORT_CHOICES = SORTS.map((s) => ({ value: s.key, label: s.label, note: s.note }));

export function FilterRow({ counts, view }: { counts: Counts; view: View }) {
  const go = useGo(view);
  return (
    <div className="filters only-desk">
      {BANDS.map((b) => (
        <button key={b.key} className="fchip" aria-pressed={view.f === b.key} onClick={() => go({ f: b.key })}>
          {b.label} <span className="n num">{counts[b.key]}</span>
        </button>
      ))}
      <Select
        label="Status"
        value={view.s}
        choices={STATUS_CHOICES}
        onChange={(v) => go({ s: v })}
        width={186}
      />
    </div>
  );
}

export function FilterStrip({ counts, view }: { counts: Counts; view: View }) {
  const go = useGo(view);
  return (
    <div className="m-chips only-mob">
      {BANDS.map((b) => (
        <button key={b.key} className="fchip" aria-pressed={view.f === b.key} onClick={() => go({ f: b.key })}>
          {b.short} <span className="n num">{counts[b.key]}</span>
        </button>
      ))}
    </div>
  );
}

export function SortSelect({ view }: { view: View }) {
  const go = useGo(view);
  return (
    <label className="row gap-sm">
      <span className="label">Sort</span>
      <Select
        label="Sort"
        value={view.sort}
        choices={SORT_CHOICES}
        onChange={(v) => go({ sort: v })}
        width={210}
        align="right"
      />
    </label>
  );
}
