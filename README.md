# Tend

A CRM for church leaders who pray for and disciple specific people. It answers one
question first: **who have I left too long?**

Built on the "Allotment" design from `../design-v2` — a printed green, graph-paper
ground, and a season band showing one cell per Sunday.

## Run it

You need a Postgres database — locally that can be Docker, or a free Neon branch.
Copy `.env.example` to `.env` and set `DATABASE_URL` and `AUTH_SECRET` first.

```bash
npm install
npx prisma migrate deploy   # create the tables
npx tsx prisma/seed.ts      # sample church, 21 people across 3 leaders
npm run dev                 # http://localhost:3000
```

> The seed **wipes every table** before inserting. Never point it at production.

Sign in with any of these, password `tend-demo-2026`:

| Email | Who |
|---|---|
| `ruth@example.com` | Higher leader — 12 people, 5 overdue, 3 sub-leaders |
| `james@example.com` | Leader |
| `hannah@example.com` | Leader |
| `admin@example.com` | Admin |

## How it works

**The ladder.** One ordered scale, rank 1–8: Not a believer, Seeking, Visited church,
Attends sometimes, Attends regularly, Believer, Serves, Leads. Moving a person writes a
`status_change` note automatically, so the ladder and the timeline never disagree.

**Overdue is derived, never stored.** `daysOverdue = today − (lastContactAt + intervalDays)`.
Writing a `Contact` row is the only thing that moves `lastContactAt`, so the list, the
follow-ups inbox and the reminder job can never disagree about it.

**Reminders.** One email per leader per day, only when someone is overdue, never on a
Sunday. Repeats every 7 days while still overdue, at most 3 times, then stops emailing
but stays in the inbox. Trigger the pass with:

```
GET /api/cron/follow-ups?key=$CRON_KEY
```

Point a scheduler at that once a day. Add `&force=1` to bypass the Sunday skip when testing.
On Vercel, `vercel.json` already schedules it for 07:00 daily; set `CRON_SECRET` and Vercel
Cron sends it as a Bearer token, so no secret has to live in this repo.

**Hierarchy.** A higher leader reads their *direct* sub-leaders' lists, read-only, and the
screen always says whose list it is. Nobody ever reads upward or sideways — a sub-leader
cannot discover they have a higher leader. Admin can read anything, and every admin read of
a person is written to that person's timeline.

**Airtable.** Two-way, status only. Names, notes, meetings and attendance never leave Tend.
The conflict rule is *the later edit wins*; on an exact tie Tend wins, because a Tend change
was made by the leader who knows the person. Nothing is silently merged and no status is
ever cleared by a sync. Configure it in Admin → Airtable.

## Configuration

`.env` (see `.env.example`):

| Key | What it does |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Session signing key. Changing it logs everyone out |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Reminder delivery. Use a Google **App Password**. Unset, mail prints to the server console |
| `CRON_KEY` | Shared secret for the reminder endpoint |
| `APP_URL` | Where reminder links point |

## Tailwind

Tailwind v4 sits alongside the hand-written design system rather than replacing it.
`globals.css` imports only Tailwind's `theme` and `utilities` layers — **preflight is
deliberately not imported**, because the reset in section 1 is ours.

Section 20 republishes the existing tokens under Tailwind's namespaces, so
`bg-plot` compiles to `var(--color-plot)` which is `var(--plot)`. The utilities and
the design system read the same values and cannot drift apart.

Utilities live in the `utilities` layer; the design classes are unlayered, so an
unlayered design class still wins on an element carrying both. That is deliberate —
adding a utility can never quietly restyle a component. Use `!` when you mean to
override.

Write new components with utilities if you prefer. Leave the season band, the ladder
and the plot ground as they are: their `nth-child` ramps and stacked gradients read
far better as CSS than as arbitrary variants.

## Prisma

Pinned to 6.x. Prisma 7 moved the datasource URL out of the schema and requires a driver
adapter, which is a separate migration.

The generated client lands in `src/generated/` and is **not** committed: its query engine is
a native binary built for whichever platform generated it, so a Windows build would break a
Linux deployment. `prisma generate` runs on `postinstall` and again on `build`.

## Layout

```
src/
  app/                 routes — people, follow-ups, team, add, admin, sign-in, welcome
  components/
    AppShell.tsx       rail on desktop, green header + tab bar on phone; content mounts once
    PersonBits.tsx     season band, ladder, status chip, priority, due flag
    Icons.tsx          one drawn SVG set, no emoji
  lib/
    db.ts              Prisma client
    status.ts          the ladder, priorities, meeting kinds
    dates.ts           overdue maths, Sundays, plain-word spans
    permissions.ts     who may read whose list
    contact.ts         logContact / setStatus — the only writers of last contact and status
    airtable.ts        two-way status sync and the conflict rule
    mail.ts            Gmail transport and the reminder email
    reminders.ts       the daily pass
  app/globals.css      the design system, ported from the mockup
```

## Deploying

Hosted on Vercel. The database must be Postgres — Vercel's filesystem is read-only
and per-request, so a SQLite file cannot survive there.

Environment variables to set on the project:

| Variable | Why |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection string |
| `AUTH_SECRET` | Seals the session JWT. `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` |
| `APP_URL` | The deployed origin, used in reminder email links |
| `CRON_SECRET` | Vercel Cron sends this as a Bearer token to the reminder job |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Optional. Without them reminders log to the console instead of sending |

`prisma generate` runs on build, so the client is built for the deployment's platform
rather than shipped from a laptop. After the first deploy, run the migration against
the production database once:

```bash
DATABASE_URL="<production url>" npx prisma migrate deploy
```
