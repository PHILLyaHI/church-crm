"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/permissions";
import { DAY, fmtDate } from "@/lib/dates";

const PRIORITY = z.enum(["high", "medium", "low"]);

/** "" from an untouched input means "not given", not an empty value. */
function blank(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : undefined;
}

// ---------------------------------------------------------------- one person

export type OneResult = { ok: boolean; added?: string; error?: string };

const OnePerson = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  statusRank: z.coerce.number().int().min(1).max(8),
  priority: PRIORITY,
  intervalDays: z.coerce.number().int().min(1).max(365),
  note: z.string().trim().max(2000).optional(),
});

export async function addOnePerson(_prev: OneResult, form: FormData): Promise<OneResult> {
  const viewer = await requireViewer();

  const parsed = OnePerson.safeParse({
    name: blank(form.get("name")) ?? "",
    phone: blank(form.get("phone")),
    email: blank(form.get("email")),
    statusRank: form.get("statusRank") ?? 1,
    priority: form.get("priority") ?? "medium",
    intervalDays: form.get("intervalDays") ?? 14,
    note: blank(form.get("note")),
  });

  if (!parsed.success) {
    return { ok: false, error: "A name is the one thing this needs." };
  }
  const data = parsed.data;

  const clash = await db.person.findFirst({
    where: { ownerId: viewer.id, archivedAt: null, name: data.name },
    select: { id: true },
  });
  if (clash) return { ok: false, error: `${data.name} is already on your list.` };

  const person = await db.person.create({
    data: {
      ownerId: viewer.id,
      createdById: viewer.id,
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      statusRank: data.statusRank,
      priority: data.priority,
      intervalDays: data.intervalDays,
      source: "manual",
    },
  });

  if (data.note) {
    await db.note.create({
      data: { personId: person.id, authorId: viewer.id, kind: "note", body: data.note },
    });
  }

  revalidatePath("/people");
  revalidatePath("/add");
  return { ok: true, added: data.name };
}

// ------------------------------------------------------------------- the CSV

const CsvRow = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  statusRank: z.number().int().min(1).max(8),
  note: z.string().trim().max(2000).optional(),
});

const CsvInput = z.object({
  filename: z.string().trim().min(1).max(200),
  intervalDays: z.number().int().min(1).max(365),
  priority: PRIORITY,
  rows: z.array(CsvRow).min(1).max(500),
});

export type ImportResult =
  | { ok: true; added: number; skipped: number; batchId: string }
  | { ok: false; error: string };

/**
 * The only write in the whole import. Everything before this — reading,
 * mapping, matching values, naming duplicates — happens in the browser and
 * touches nothing. Duplicates are decided again here against the database,
 * because the browser's copy of the list can be stale.
 */
export async function importCsv(input: unknown): Promise<ImportResult> {
  const viewer = await requireViewer();

  const parsed = CsvInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That file could not be read. Check the mapping and try again." };
  }
  const { filename, intervalDays, priority, rows } = parsed.data;

  const mine = await db.person.findMany({
    where: { ownerId: viewer.id, archivedAt: null },
    select: { name: true },
  });
  const taken = new Set(mine.map((p) => p.name.trim().toLowerCase()));

  const keep: typeof rows = [];
  for (const row of rows) {
    const key = row.name.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    keep.push(row);
  }

  const skipped = rows.length - keep.length;
  if (keep.length === 0) {
    return { ok: false, error: "Everyone in that file is already on your list." };
  }

  const batch = await db.importBatch.create({
    data: { userId: viewer.id, filename, count: keep.length },
  });

  const stamp = fmtDate(new Date());
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (const row of keep) {
    const id = randomUUID();
    ops.push(
      db.person.create({
        data: {
          id,
          ownerId: viewer.id,
          createdById: viewer.id,
          name: row.name,
          phone: row.phone ?? null,
          email: row.email ?? null,
          statusRank: row.statusRank,
          priority,
          intervalDays,
          source: "csv",
          importBatchId: batch.id,
        },
      }),
    );
    ops.push(
      db.note.create({
        data: { personId: id, kind: "system", body: `Added from ${filename} on ${stamp}.` },
      }),
    );
    if (row.note) {
      ops.push(
        db.note.create({
          data: { personId: id, authorId: viewer.id, kind: "note", body: row.note },
        }),
      );
    }
  }

  await db.$transaction(ops);

  revalidatePath("/people");
  revalidatePath("/add");
  return { ok: true, added: keep.length, skipped, batchId: batch.id };
}

// ---------------------------------------------------------------------- undo

export type UndoResult = { ok: boolean; removed?: number; error?: string };

/**
 * An import is one thing, so undoing it is one thing: the people it made go,
 * and the batch is marked. Anything added by hand afterwards is untouched.
 * Open for 24 hours, from the banner on the people list.
 */
export async function undoImport(batchId: string): Promise<UndoResult> {
  const viewer = await requireViewer();

  const batch = await db.importBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.userId !== viewer.id) {
    return { ok: false, error: "That import isn't yours to undo." };
  }
  if (batch.undoneAt) {
    return { ok: false, error: "That import has already been undone." };
  }
  if (Date.now() - batch.createdAt.getTime() > DAY) {
    return { ok: false, error: "An import can be undone for 24 hours. That window has closed." };
  }

  const gone = await db.person.deleteMany({
    where: { importBatchId: batch.id, ownerId: viewer.id, source: "csv" },
  });
  await db.importBatch.update({ where: { id: batch.id }, data: { undoneAt: new Date() } });

  revalidatePath("/people");
  revalidatePath("/add");
  return { ok: true, removed: gone.count };
}

/** The same undo, shaped for a <form action> on the people list. */
export async function undoImportForm(form: FormData): Promise<void> {
  const batchId = String(form.get("batchId") ?? "");
  const result = await undoImport(batchId);
  redirect(
    result.ok
      ? `/people?undone=${result.removed ?? 0}`
      : `/people?err=${encodeURIComponent(result.error ?? "That import could not be undone.")}`,
  );
}
