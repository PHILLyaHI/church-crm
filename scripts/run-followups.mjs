// Triggers the reminder pass against a running dev server.
//   npm run cron:followups
// Reads CRON_KEY from .env so the endpoint's guard is satisfied.

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const base = env.APP_URL || "http://localhost:3000";
const url = `${base}/api/cron/follow-ups?key=${encodeURIComponent(env.CRON_KEY ?? "")}&force=1`;

const res = await fetch(url).catch((e) => {
  console.error(`Could not reach ${base}. Is the dev server running?\n${e.message}`);
  process.exit(1);
});

console.log(res.status, await res.text());
