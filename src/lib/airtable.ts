import { db } from "@/lib/db";
import { LADDER } from "@/lib/status";

/**
 * Two-way status sync, status only. Names, notes, meetings and attendance
 * never leave Tend.
 *
 * Conflict rule — the later edit wins. If both sides changed since the last
 * sync the more recent edit is written and the losing value goes to the log
 * with both timestamps. On an exact tie Tend wins, because a Tend change was
 * made by the leader who actually knows the person. Nothing is ever silently
 * merged and no status is ever cleared by a sync.
 */

const API = "https://api.airtable.com/v0";

export type Config = {
  enabled: boolean;
  token: string | null;
  baseId: string | null;
  tableName: string | null;
  viewName: string | null;
  tendIdField: string;
  statusField: string;
  mapping: Record<string, string>;
  defaultOwnerId: string | null;
  lastSyncAt: Date | null;
};

export async function getConfig(): Promise<Config | null> {
  const row = await db.airtableConfig.findUnique({ where: { id: "singleton" } });
  if (!row) return null;
  let mapping: Record<string, string> = {};
  try {
    mapping = JSON.parse(row.mapping || "{}");
  } catch {
    mapping = {};
  }
  return { ...row, mapping };
}

function ready(c: Config | null): c is Config {
  return Boolean(c?.enabled && c.token && c.baseId && c.tableName);
}

/** Ladder rank -> the Airtable single-select option an admin mapped to it. */
function optionForRank(c: Config, rank: number) {
  return c.mapping[String(rank)] ?? null;
}

/** Airtable option -> ladder rank. Unmapped options are never guessed. */
function rankForOption(c: Config, option: string | null) {
  if (!option) return null;
  const hit = Object.entries(c.mapping).find(
    ([, v]) => v.toLowerCase() === option.toLowerCase(),
  );
  return hit ? Number(hit[0]) : null;
}

async function call(c: Config, path: string, init?: RequestInit) {
  const res = await fetch(`${API}/${c.baseId}/${encodeURIComponent(c.tableName!)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${c.token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Airtable ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json();
}

async function log(entry: {
  direction: string;
  personId?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  result: string;
  detail?: string;
}) {
  await db.syncEvent.create({ data: { ...entry, personId: entry.personId ?? null } });
}

/** Called whenever a status changes in Tend. Silent no-op when not configured. */
export async function pushStatus(personId: string) {
  const c = await getConfig();
  if (!ready(c)) return;

  const person = await db.person.findUnique({
    where: { id: personId },
    select: { id: true, name: true, statusRank: true, airtableRecordId: true },
  });
  if (!person) return;

  const option = optionForRank(c, person.statusRank);
  if (!option) {
    await log({
      direction: "out",
      personId,
      toValue: String(person.statusRank),
      result: "skipped",
      detail: `Step ${person.statusRank} has no Airtable option mapped to it.`,
    });
    return;
  }

  try {
    if (person.airtableRecordId) {
      await call(c, `/${person.airtableRecordId}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: { [c.statusField]: option } }),
      });
    } else {
      const created = await call(c, "", {
        method: "POST",
        body: JSON.stringify({
          records: [
            {
              fields: {
                Name: person.name,
                [c.tendIdField]: person.id,
                [c.statusField]: option,
              },
            },
          ],
        }),
      });
      const id = created?.records?.[0]?.id;
      if (id) {
        await db.person.update({ where: { id: person.id }, data: { airtableRecordId: id } });
      }
    }
    await db.person.update({
      where: { id: person.id },
      data: { airtableSyncedAt: new Date() },
    });
    await log({ direction: "out", personId, toValue: option, result: "applied" });
  } catch (e) {
    await log({
      direction: "out",
      personId,
      toValue: option,
      result: "skipped",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

export type SyncSummary = {
  ok: boolean;
  pulled: number;
  pushed: number;
  created: number;
  skipped: number;
  conflicts: number;
  error?: string;
};

/** A full pass in both directions. Runs from Admin and from the cron endpoint. */
export async function fullSync(): Promise<SyncSummary> {
  const c = await getConfig();
  const summary: SyncSummary = { ok: true, pulled: 0, pushed: 0, created: 0, skipped: 0, conflicts: 0 };
  if (!ready(c)) return { ...summary, ok: false, error: "Airtable is not connected." };

  const since = c.lastSyncAt ?? new Date(0);

  try {
    // ---- inbound -------------------------------------------------------
    let offset: string | undefined;
    do {
      const query = new URLSearchParams();
      if (c.viewName) query.set("view", c.viewName);
      if (offset) query.set("offset", offset);
      const page = await call(c, `?${query.toString()}`);
      offset = page.offset;

      for (const rec of page.records ?? []) {
        const tendId: string | undefined = rec.fields?.[c.tendIdField];
        const option: string | null = rec.fields?.[c.statusField] ?? null;
        const rank = rankForOption(c, option);
        const changedAt = rec.fields?.["Status changed"]
          ? new Date(rec.fields["Status changed"])
          : new Date(rec.createdTime);

        if (option && rank === null) {
          summary.skipped++;
          await log({
            direction: "in",
            fromValue: option,
            result: "skipped",
            detail: `"${option}" is not mapped to a step. Map it or mark it ignored.`,
          });
          continue;
        }

        const person = tendId
          ? await db.person.findUnique({ where: { id: tendId } })
          : await db.person.findFirst({ where: { airtableRecordId: rec.id } });

        // A record with no Tend ID is new: create it under the default owner.
        if (!person) {
          if (!c.defaultOwnerId || !rec.fields?.Name) {
            summary.skipped++;
            continue;
          }
          const made = await db.person.create({
            data: {
              name: String(rec.fields.Name),
              ownerId: c.defaultOwnerId,
              statusRank: rank ?? 1,
              source: "airtable",
              airtableRecordId: rec.id,
              airtableSyncedAt: new Date(),
            },
          });
          await call(c, `/${rec.id}`, {
            method: "PATCH",
            body: JSON.stringify({ fields: { [c.tendIdField]: made.id } }),
          });
          summary.created++;
          await log({ direction: "in", personId: made.id, toValue: option, result: "applied", detail: "Created in Tend." });
          continue;
        }

        if (rank === null || rank === person.statusRank) continue;

        const tendChanged = person.statusChangedAt > since;
        const airtableChanged = changedAt > since;

        if (tendChanged && airtableChanged) {
          summary.conflicts++;
          const tendWins = person.statusChangedAt >= changedAt;
          if (tendWins) {
            await log({
              direction: "conflict",
              personId: person.id,
              fromValue: option,
              toValue: LADDER[person.statusRank - 1].name,
              result: "conflict",
              detail: `Both sides changed. Tend edit ${person.statusChangedAt.toISOString()} beat Airtable ${changedAt.toISOString()}. Airtable value "${option}" was overwritten.`,
            });
            await pushStatus(person.id);
            summary.pushed++;
          } else {
            await db.person.update({
              where: { id: person.id },
              data: { statusRank: rank, statusChangedAt: changedAt, airtableSyncedAt: new Date(), airtableRecordId: rec.id },
            });
            await db.note.create({
              data: { personId: person.id, kind: "system", body: `Status set to ${LADDER[rank - 1].name} from Airtable.`, fromRank: person.statusRank, toRank: rank },
            });
            await log({
              direction: "conflict",
              personId: person.id,
              fromValue: LADDER[person.statusRank - 1].name,
              toValue: option,
              result: "conflict",
              detail: `Both sides changed. Airtable edit ${changedAt.toISOString()} beat Tend ${person.statusChangedAt.toISOString()}. Tend value "${LADDER[person.statusRank - 1].name}" was overwritten.`,
            });
            summary.pulled++;
          }
          continue;
        }

        if (airtableChanged) {
          await db.person.update({
            where: { id: person.id },
            data: { statusRank: rank, statusChangedAt: changedAt, airtableSyncedAt: new Date(), airtableRecordId: rec.id },
          });
          await db.note.create({
            data: { personId: person.id, kind: "system", body: `Status set to ${LADDER[rank - 1].name} from Airtable.`, fromRank: person.statusRank, toRank: rank },
          });
          summary.pulled++;
          await log({ direction: "in", personId: person.id, toValue: option, result: "applied" });
        }
      }
    } while (offset);

    // ---- outbound: anything Tend changed since the last pass ------------
    const changed = await db.person.findMany({
      where: { statusChangedAt: { gt: since }, archivedAt: null },
      select: { id: true },
    });
    for (const p of changed) {
      await pushStatus(p.id);
      summary.pushed++;
    }

    await db.airtableConfig.update({
      where: { id: "singleton" },
      data: { lastSyncAt: new Date() },
    });
    await log({ direction: "full", result: "applied", detail: `Pulled ${summary.pulled}, pushed ${summary.pushed}, created ${summary.created}, skipped ${summary.skipped}, conflicts ${summary.conflicts}.` });
    return summary;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await log({ direction: "full", result: "skipped", detail: error });
    return { ...summary, ok: false, error };
  }
}

/** Reads the table's status options so an admin maps real values, not guesses. */
export async function readStatusOptions(): Promise<string[]> {
  const c = await getConfig();
  if (!c?.token || !c.baseId || !c.tableName) return [];
  try {
    const res = await fetch(`${API}/meta/bases/${c.baseId}/tables`, {
      headers: { Authorization: `Bearer ${c.token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const table = data.tables?.find(
      (t: { name: string }) => t.name.toLowerCase() === c.tableName!.toLowerCase(),
    );
    const field = table?.fields?.find(
      (f: { name: string }) => f.name.toLowerCase() === c.statusField.toLowerCase(),
    );
    return (field?.options?.choices ?? []).map((c2: { name: string }) => c2.name);
  } catch {
    return [];
  }
}
