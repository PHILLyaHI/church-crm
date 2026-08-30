import Link from "next/link";
import { Icon } from "@/components/Icons";
import { AlertGlyph } from "@/components/admin/Glyphs";

export type AdminSection = "users" | "airtable" | "reminders";

/** The four things that live behind Admin, in the order they matter. */
export function AdminNav({ current, users }: { current: AdminSection; users: number }) {
  return (
    <nav className="subnav admin-subnav">
      <Link href="/admin" aria-current={current === "users" ? "page" : undefined}>
        Users <span className="num t-quiet">{users}</span>
      </Link>
      <Link href="/admin#who">Who reports to whom</Link>
      <Link href="/admin/airtable" aria-current={current === "airtable" ? "page" : undefined}>
        Airtable
      </Link>
      <Link href="/admin/reminders" aria-current={current === "reminders" ? "page" : undefined}>
        Reminders
      </Link>
    </nav>
  );
}

/** What the last action did, in one line, above the thing it changed. */
export function Said({ msg, err }: { msg?: string; err?: string }) {
  if (!msg && !err) return null;
  return err ? (
    <div className="banner banner--over mb-4">
      <AlertGlyph />
      <span>{err}</span>
    </div>
  ) : (
    <div className="banner banner--ok mb-4">
      <Icon name="check" />
      <span>{msg}</span>
    </div>
  );
}
