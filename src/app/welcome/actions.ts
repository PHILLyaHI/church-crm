"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/permissions";
import { INTERVAL_CHOICES } from "@/lib/status";

/** First run is over the moment a leader has done it, skipped or not. */
async function finish(userId: string) {
  await db.user.update({ where: { id: userId }, data: { onboardedAt: new Date() } });
}

export async function addFirstPerson(form: FormData) {
  const viewer = await requireViewer();

  const name = String(form.get("name") ?? "").trim();
  if (!name) return;

  const rank = Math.min(8, Math.max(1, Math.round(Number(form.get("rank") ?? 1)) || 1));
  const asked = Number(form.get("interval"));
  const intervalDays = INTERVAL_CHOICES.includes(asked) ? asked : 14;

  await db.person.create({
    data: {
      ownerId: viewer.id,
      createdById: viewer.id,
      name,
      statusRank: rank,
      intervalDays,
      source: "manual",
    },
  });
  await finish(viewer.id);

  redirect("/people");
}

export async function skipFirstRun() {
  const viewer = await requireViewer();
  await finish(viewer.id);
  redirect("/people");
}
