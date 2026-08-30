// The list view: filter band, status, sort. It lives in the URL so a filtered
// list can be sent to someone. Shared by the page and its controls.

export type Counts = { all: number; over: number; soon: number; high: number };
export type View = { f: string; s: string; sort: string };

export const BANDS = [
  { key: "all", label: "All", short: "All" },
  { key: "over", label: "Overdue", short: "Overdue" },
  { key: "soon", label: "Due soon", short: "Due soon" },
  { key: "high", label: "High priority", short: "High" },
] as const;

export const SORTS = [
  { key: "over", label: "Most overdue", note: "Sorted by how long they have waited." },
  { key: "name", label: "Name A–Z", note: "Sorted by name." },
  { key: "priority", label: "Priority", note: "Sorted by priority, then by wait." },
  { key: "ladder", label: "Furthest up the ladder", note: "Sorted by where they are." },
  { key: "added", label: "Recently added", note: "Newest first." },
] as const;

export function readView(sp: Record<string, string | string[] | undefined>): View {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const f = one(sp.f);
  const s = one(sp.s);
  const sort = one(sp.sort);
  return {
    f: BANDS.some((b) => b.key === f) ? f : "all",
    s: /^[1-8]$/.test(s) ? s : "",
    sort: SORTS.some((x) => x.key === sort) ? sort : "over",
  };
}

export function sortNote(sort: string) {
  return SORTS.find((s) => s.key === sort)?.note ?? SORTS[0].note;
}
