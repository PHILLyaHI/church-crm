"use client";

import { useOptimistic, useState, useTransition } from "react";
import { LADDER } from "@/lib/status";

/**
 * The ladder is the one control on this screen worth a client component: the
 * step you press fills before the server answers.
 */
export function LadderPick({
  rank,
  action,
}: {
  rank: number;
  action: (rank: number) => Promise<void>;
}) {
  const [shown, setShown] = useOptimistic(rank);
  return (
    <form
      className="ladder-pick"
      action={(data: FormData) => {
        const next = Number(data.get("rank"));
        setShown(next);
        return action(next);
      }}
    >
      {LADDER.map((s) => (
        <button
          key={s.rank}
          name="rank"
          value={s.rank}
          aria-pressed={s.rank === shown}
          className={s.rank < shown ? "done" : undefined}
        >
          <span className="rk num">{s.rank}</span>
          <span className="nm">{s.name}</span>
        </button>
      ))}
    </form>
  );
}

export function ReminderToggle({
  paused,
  action,
  large,
}: {
  paused: boolean;
  action: (paused: boolean) => Promise<void>;
  large?: boolean;
}) {
  const [pending, start] = useTransition();
  const box = (
    <input
      type="checkbox"
      defaultChecked={!paused}
      disabled={pending}
      onChange={(e) => {
        const off = !e.currentTarget.checked;
        start(async () => {
          await action(off);
        });
      }}
      style={{
        accentColor: "var(--plot)",
        width: large ? 22 : 16,
        height: large ? 22 : 16,
      }}
    />
  );
  if (large) return box;
  return (
    <label className="row gap-sm mt-4" style={{ fontSize: ".8125rem" }}>
      {box} Email me when they are overdue
    </label>
  );
}

/** Phone: one thing dominates the screen, so the three logs share a control. */
export function PersonPanels({
  contacts,
  history,
  sundays,
}: {
  contacts: React.ReactNode;
  history: React.ReactNode;
  sundays: React.ReactNode;
}) {
  const [tab, setTab] = useState<"contacts" | "history" | "att">("contacts");
  const seg = (key: "contacts" | "history" | "att", label: string) => (
    <button
      aria-pressed={tab === key}
      onClick={() => setTab(key)}
      style={{ flex: 1, justifyContent: "center" }}
    >
      {label}
    </button>
  );
  return (
    <>
      <div className="seg mb-4" style={{ width: "100%" }}>
        {seg("contacts", "Contacts")}
        {seg("history", "History")}
        {seg("att", "Sundays")}
      </div>
      <div hidden={tab !== "contacts"}>{contacts}</div>
      <div hidden={tab !== "history"}>{history}</div>
      <div hidden={tab !== "att"}>{sundays}</div>
    </>
  );
}
