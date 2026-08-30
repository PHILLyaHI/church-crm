import { db } from "@/lib/db";
import { DAY, ago, since } from "@/lib/dates";
import { Icon } from "@/components/Icons";
import { undoImportForm } from "@/app/add/actions";

/**
 * For 24 hours an import can be taken back whole — the people it made go, and
 * nothing else does. After that it is not an import any more, just people.
 *
 * Drop this at the top of the people list (and it also sits on Add people, so
 * the way back is never more than one screen from the way in).
 */
export async function UndoBanner({ viewerId }: { viewerId: string }) {
  const batch = await db.importBatch.findFirst({
    where: {
      userId: viewerId,
      undoneAt: null,
      count: { gt: 0 },
      createdAt: { gt: since(DAY) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!batch) return null;

  return (
    <div className="banner banner--ok mb-4">
      <Icon name="check" />
      <span>
        <b>
          {batch.count} {batch.count === 1 ? "person" : "people"}
        </b>{" "}
        came in from {batch.filename}, {ago(batch.createdAt).toLowerCase()}.
      </span>
      <span className="right">
        <form action={undoImportForm}>
          <input type="hidden" name="batchId" value={batch.id} />
          <button className="btn btn--quiet btn--sm" type="submit">
            <Icon name="trash" size="sm" /> Undo the import
          </button>
        </form>
      </span>
    </div>
  );
}
