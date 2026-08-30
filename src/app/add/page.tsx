import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icons";
import { AddPeople } from "@/components/import/AddPeople";
import { UndoBanner } from "@/components/import/UndoBanner";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/permissions";
import "@/styles/admin.css";

export const metadata = { title: "Add people — Tend" };

export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireViewer();
  const asked = (await searchParams).tab;
  const tab = (Array.isArray(asked) ? asked[0] : asked) === "csv" ? "csv" : "one";

  const [mine, defaults] = await Promise.all([
    db.person.findMany({
      where: { ownerId: viewer.id, archivedAt: null },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    db.reminderDefaults.findUnique({ where: { id: "singleton" } }),
  ]);

  return (
    <AppShell
      viewer={viewer}
      current="import"
      title="Add people"
      sub="One at a time, or a whole list at once."
      crumb={
        <>
          <Link href="/people">People</Link>{" "}
          <Icon name="chev" size="sm" style={{ stroke: "var(--rule-2)" }} /> <b>Add people</b>
        </>
      }
    >
      <UndoBanner viewerId={viewer.id} />
      <AddPeople
        existingNames={mine.map((p) => p.name)}
        defaultInterval={defaults?.defaultIntervalDays ?? 14}
        initialTab={tab}
      />
    </AppShell>
  );
}
