// The ladder: one ordered scale, rank 1-8. Position is the meaning; colour is not.

export type Priority = "high" | "medium" | "low";
export type Role = "leader" | "higher_leader" | "admin";

export const LADDER = [
  { rank: 1, name: "Not a believer", short: "Not a believer" },
  { rank: 2, name: "Seeking", short: "Seeking" },
  { rank: 3, name: "Visited church", short: "Visited" },
  { rank: 4, name: "Attends sometimes", short: "Sometimes" },
  { rank: 5, name: "Attends regularly", short: "Regularly" },
  { rank: 6, name: "Believer", short: "Believer" },
  { rank: 7, name: "Serves", short: "Serves" },
  { rank: 8, name: "Leads", short: "Leads" },
] as const;

export function step(rank: number) {
  return LADDER[Math.min(8, Math.max(1, Math.round(rank))) - 1];
}

/** Three tints, not eight: outside the church, inside it, giving to it. */
export function chipClass(rank: number) {
  if (rank >= 7) return "chip chip--serve";
  if (rank >= 4) return "chip chip--in";
  return "chip chip--out";
}

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function priClass(priority: string) {
  return `pri pri--${priority === "high" ? "high" : priority === "low" ? "low" : "med"}`;
}

export function priLabel(priority: string) {
  return priority === "high" ? "High" : priority === "low" ? "Low" : "Medium";
}

export const MEETING_KINDS = [
  { value: "coffee", label: "Coffee" },
  { value: "call", label: "Call" },
  { value: "meal", label: "Meal" },
  { value: "visit", label: "Visit" },
  { value: "message", label: "Message" },
  { value: "group", label: "Group" },
] as const;

export function meetingLabel(kind: string) {
  return MEETING_KINDS.find((k) => k.value === kind)?.label ?? "Meeting";
}

export const INTERVAL_CHOICES = [7, 14, 21, 28, 56];

export function roleLabel(role: string) {
  return role === "admin" ? "Admin" : role === "higher_leader" ? "Higher leader" : "Leader";
}
