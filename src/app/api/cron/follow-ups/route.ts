import { runFollowUps } from "@/lib/reminders";

/**
 * The daily pass, for whatever runs the clock — Vercel Cron, Task Scheduler,
 * a curl in a crontab. Once a day:
 *
 *   GET /api/cron/follow-ups?key=$CRON_KEY
 *
 * Add &force=1 to bypass the Sunday skip when testing.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  // Two ways in, because the two callers cannot use the same one. A crontab or
  // curl passes ?key=. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
  // and cannot carry a query secret, which in a public repo would have to be
  // committed. Either satisfies it; neither being set refuses everything.
  const key = process.env.CRON_KEY;
  const bearer = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  const byKey = Boolean(key) && url.searchParams.get("key") === key;
  const byBearer = Boolean(bearer) && auth === `Bearer ${bearer}`;

  if (!byKey && !byBearer) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runFollowUps({ force: url.searchParams.get("force") === "1" });
  return Response.json(result);
}
