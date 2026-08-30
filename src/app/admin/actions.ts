"use server";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";
import { fullSync, getConfig } from "@/lib/airtable";
import { runFollowUps } from "@/lib/reminders";
import { joinMapping, splitMapping } from "@/components/admin/mapping";

const ROLES = ["leader", "higher_leader", "admin"] as const;

function text(form: FormData, key: string) {
  const v = form.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

function whole(form: FormData, key: string, fallback: number) {
  const raw = text(form, key);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

/** Every action ends the same way: back to the screen, saying what happened. */
function back(path: string, kind: "msg" | "err", words: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(words)}`);
}

// ------------------------------------------------------------------- users

export async function inviteUser(form: FormData): Promise<void> {
  await requireAdmin();

  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80),
      email: z.string().trim().toLowerCase().email().max(160),
      role: z.enum(ROLES),
      leaderId: z.string().nullable(),
    })
    .safeParse({
      name: text(form, "name") ?? "",
      email: text(form, "email") ?? "",
      role: text(form, "role") ?? "leader",
      leaderId: text(form, "leaderId"),
    });

  if (!parsed.success) back("/admin", "err", "That needs a name and a real email address.");
  const data = parsed.data;

  const taken = await db.user.findUnique({ where: { email: data.email } });
  if (taken) back("/admin", "err", `${data.email} already has an account.`);

  // A random password nobody knows: the invitation is the way in.
  const passwordHash = await bcrypt.hash(randomUUID(), 10);
  await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      leaderId: data.role === "leader" ? data.leaderId : null,
      invitedAt: new Date(),
    },
  });

  revalidatePath("/admin");
  back("/admin", "msg", `${data.name} is invited. Send them the sign-in link to set a password.`);
}

export async function setRole(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = text(form, "userId");
  const role = text(form, "role");

  if (!userId || !role || !ROLES.includes(role as (typeof ROLES)[number])) {
    back("/admin", "err", "Pick a person and a role.");
  }
  if (userId === admin.id) {
    back("/admin", "err", "Nobody changes their own role. Ask another admin.");
  }

  const user = await db.user.findUnique({ where: { id: userId! }, select: { name: true } });
  if (!user) back("/admin", "err", "That user is gone.");

  // An admin sits outside the tree; everyone else keeps whoever they report to.
  await db.user.update({
    where: { id: userId! },
    data: { role: role!, ...(role === "admin" ? { leaderId: null } : {}) },
  });

  revalidatePath("/admin");
  back("/admin", "msg", `${user!.name} is now a ${role === "higher_leader" ? "higher leader" : role}.`);
}

/** Nobody may end up above themselves; the tree has to stay a tree. */
async function wouldLoop(userId: string, leaderId: string) {
  let cursor: string | null = leaderId;
  const walked = new Set<string>();
  while (cursor) {
    if (cursor === userId) return true;
    if (walked.has(cursor)) return true;
    walked.add(cursor);
    const up: { leaderId: string | null } | null = await db.user.findUnique({
      where: { id: cursor },
      select: { leaderId: true },
    });
    cursor = up?.leaderId ?? null;
  }
  return false;
}

export async function linkLeader(form: FormData): Promise<void> {
  await requireAdmin();
  const userId = text(form, "userId");
  const leaderId = text(form, "leaderId");
  if (!userId) back("/admin", "err", "Pick someone to link.");

  const user = await db.user.findUnique({ where: { id: userId! }, select: { name: true } });
  if (!user) back("/admin", "err", "That user is gone.");

  if (!leaderId) {
    await db.user.update({ where: { id: userId! }, data: { leaderId: null } });
    revalidatePath("/admin");
    back("/admin", "msg", `${user!.name} reports to nobody now. They keep their own people.`);
  }

  if (leaderId === userId) {
    back("/admin", "err", `${user!.name} cannot report to themselves.`);
  }

  const leader = await db.user.findUnique({ where: { id: leaderId! }, select: { name: true } });
  if (!leader) back("/admin", "err", "That leader is gone.");

  if (await wouldLoop(userId!, leaderId!)) {
    back(
      "/admin",
      "err",
      `${leader!.name} already reports to ${user!.name}, directly or further up. That would make a circle, and reading only ever goes downward.`,
    );
  }

  await db.user.update({ where: { id: userId! }, data: { leaderId } });
  revalidatePath("/admin");
  back("/admin", "msg", `${user!.name} reports to ${leader!.name}.`);
}

// ---------------------------------------------------------------- airtable

const AIRTABLE = "/admin/airtable";

export async function saveAirtable(form: FormData): Promise<void> {
  await requireAdmin();

  const token = text(form, "token");
  const baseId = text(form, "baseId");
  const tableName = text(form, "tableName");
  const viewName = text(form, "viewName");
  const tendIdField = text(form, "tendIdField") ?? "Tend ID";
  const statusField = text(form, "statusField") ?? "Status";
  const defaultOwnerId = text(form, "defaultOwnerId");
  const enabled = form.get("enabled") === "on";

  const current = await db.airtableConfig.findUnique({ where: { id: "singleton" } });

  if (enabled && !baseId) back(AIRTABLE, "err", "A base is needed before the sync can run.");
  if (enabled && !tableName) back(AIRTABLE, "err", "A table is needed before the sync can run.");
  if (enabled && !token && !current?.token) {
    back(AIRTABLE, "err", "A personal access token is needed before the sync can run.");
  }

  await db.airtableConfig.upsert({
    where: { id: "singleton" },
    update: {
      enabled,
      baseId,
      tableName,
      viewName,
      tendIdField,
      statusField,
      defaultOwnerId,
      // A blank token box leaves the stored one alone. It is never read back out.
      ...(token ? { token } : {}),
    },
    create: {
      id: "singleton",
      enabled,
      token,
      baseId,
      tableName,
      viewName,
      tendIdField,
      statusField,
      defaultOwnerId,
    },
  });

  revalidatePath(AIRTABLE);
  back(AIRTABLE, "msg", "Connection saved.");
}

export async function disconnectAirtable(): Promise<void> {
  await requireAdmin();
  await db.airtableConfig.update({
    where: { id: "singleton" },
    data: { enabled: false, token: null },
  });
  revalidatePath(AIRTABLE);
  back(AIRTABLE, "msg", "Disconnected. The token is deleted; nothing else changed.");
}

export async function saveMapping(form: FormData): Promise<void> {
  await requireAdmin();
  const config = await getConfig();
  const current = splitMapping(config?.mapping ?? {});

  const steps: Record<string, string> = {};
  for (let rank = 1; rank <= 8; rank++) {
    const option = text(form, `step-${rank}`);
    if (option) steps[String(rank)] = option;
  }

  await db.airtableConfig.update({
    where: { id: "singleton" },
    data: { mapping: JSON.stringify(joinMapping({ steps, ignored: current.ignored })) },
  });

  revalidatePath(AIRTABLE);
  back(AIRTABLE, "msg", "Status mapping saved.");
}

/** One unmapped Airtable option, answered: it becomes a step, or it is ignored. */
export async function resolveOption(form: FormData): Promise<void> {
  await requireAdmin();
  const option = text(form, "option");
  const answer = text(form, "answer");
  if (!option || !answer) back(AIRTABLE, "err", "Choose what that option means.");

  const config = await getConfig();
  const current = splitMapping(config?.mapping ?? {});

  if (answer === "ignore") {
    current.ignored = [...new Set([...current.ignored, option!])];
  } else if (/^[1-8]$/.test(answer!)) {
    current.steps[answer!] = option!;
    current.ignored = current.ignored.filter((o) => o !== option);
  } else {
    back(AIRTABLE, "err", "That isn't one of the eight steps.");
  }

  await db.airtableConfig.update({
    where: { id: "singleton" },
    data: { mapping: JSON.stringify(joinMapping(current)) },
  });

  revalidatePath(AIRTABLE);
  back(AIRTABLE, "msg", answer === "ignore" ? `“${option}” is ignored.` : `“${option}” is mapped.`);
}

export async function syncNow(): Promise<void> {
  await requireAdmin();
  const summary = await fullSync();
  revalidatePath(AIRTABLE);

  if (!summary.ok) back(AIRTABLE, "err", summary.error ?? "The sync did not finish.");
  back(
    AIRTABLE,
    "msg",
    `Pulled ${summary.pulled}, pushed ${summary.pushed}, created ${summary.created}, skipped ${summary.skipped}, conflicts ${summary.conflicts}.`,
  );
}

// --------------------------------------------------------------- reminders

const REMINDERS = "/admin/reminders";

export async function saveReminders(form: FormData): Promise<void> {
  await requireAdmin();

  const data = {
    defaultIntervalDays: whole(form, "defaultIntervalDays", 14),
    sendHour: Math.min(23, Math.max(0, whole(form, "sendHour", 7))),
    digest: form.get("digest") === "digest",
    skipSunday: form.get("skipSunday") === "on",
    repeatDays: Math.min(90, Math.max(1, whole(form, "repeatDays", 7))),
    maxAttempts: Math.min(10, Math.max(1, whole(form, "maxAttempts", 3))),
    fromName: text(form, "fromName") ?? "Tend",
    fromAddress: text(form, "fromAddress") ?? "reminders@example.com",
  };

  await db.reminderDefaults.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  revalidatePath(REMINDERS);
  back(REMINDERS, "msg", "Defaults saved.");
}

export async function runRemindersNow(): Promise<void> {
  await requireAdmin();
  const run = await runFollowUps({ force: true });
  revalidatePath(REMINDERS);

  if (run.skipped) back(REMINDERS, "msg", run.skipped);

  const sent = run.leaders.filter((l) => l.sent);
  if (sent.length === 0) back(REMINDERS, "msg", "Nothing was due. No email went out.");

  const people = sent.reduce((n, l) => n + l.people, 0);
  const delivered = sent.filter((l) => l.delivered).length;
  back(
    REMINDERS,
    "msg",
    `${sent.length} ${sent.length === 1 ? "leader" : "leaders"} emailed about ${people} ${
      people === 1 ? "person" : "people"
    }.${delivered === 0 ? " Gmail is not set up, so they were written to the console." : ""}`,
  );
}
