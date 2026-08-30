import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

function sundays(n: number) {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  for (let i = n - 1; i >= 0; i--) {
    const s = new Date(d);
    s.setDate(d.getDate() - i * 7);
    out.push(s);
  }
  return out;
}

async function main() {
  await db.syncEvent.deleteMany();
  await db.notification.deleteMany();
  await db.reminder.deleteMany();
  await db.attendance.deleteMany();
  await db.contact.deleteMany();
  await db.meeting.deleteMany();
  await db.note.deleteMany();
  await db.person.deleteMany();
  await db.importBatch.deleteMany();
  await db.user.deleteMany();

  const pw = await bcrypt.hash("tend-demo-2026", 10);

  const ruth = await db.user.create({
    data: {
      name: "Ruth Adeyemi",
      email: "ruth@example.com",
      passwordHash: pw,
      role: "higher_leader",
      onboardedAt: ago(240),
    },
  });

  const admin = await db.user.create({
    data: {
      name: "Tobi Adekunle",
      email: "admin@example.com",
      passwordHash: pw,
      role: "admin",
      onboardedAt: ago(300),
    },
  });

  const james = await db.user.create({
    data: {
      name: "James Ferreira",
      email: "james@example.com",
      passwordHash: pw,
      role: "leader",
      leaderId: ruth.id,
      onboardedAt: ago(120),
    },
  });

  const hannah = await db.user.create({
    data: {
      name: "Hannah Boateng",
      email: "hannah@example.com",
      passwordHash: pw,
      role: "leader",
      leaderId: ruth.id,
      onboardedAt: ago(90),
    },
  });

  const leon = await db.user.create({
    data: {
      name: "Leon Marsh",
      email: "leon@example.com",
      passwordHash: pw,
      role: "leader",
      leaderId: ruth.id,
      invitedAt: ago(4),
    },
  });

  await db.reminderDefaults.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      fromName: "Tend",
      fromAddress: "reminders@fieldgate.church",
    },
  });

  await db.airtableConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      enabled: false,
      baseId: "",
      tableName: "People",
      viewName: "Grid view",
      defaultOwnerId: ruth.id,
      mapping: JSON.stringify({
        "1": "Not a believer",
        "2": "Seeking",
        "3": "Visited",
        "4": "Comes sometimes",
        "5": "Regular",
        "6": "Believer",
        "7": "Serving",
        "8": "Leading",
      }),
    },
  });

  type Row = {
    name: string;
    owner: string;
    rank: number;
    priority: string;
    interval: number;
    lastContactDaysAgo: number | null;
    phone?: string;
    email?: string;
    note?: string;
    attendance?: number[]; // indexes of the last 16 Sundays that were present
    away?: number[];
  };

  const rows: Row[] = [
    { name: "Daniel Okafor", owner: ruth.id, rank: 2, priority: "high", interval: 14, lastContactDaysAgo: 15, phone: "07700 900418", email: "daniel.okafor@example.com", note: "Asked what the difference is between praying and wishing. Wants to talk again before he comes on a Sunday.", attendance: [4, 9, 13] },
    { name: "Sam Whitfield", owner: ruth.id, rank: 1, priority: "high", interval: 14, lastContactDaysAgo: 27, phone: "07700 900233", note: "Lost his father in March. Says church is 'not for him' but keeps asking questions.", attendance: [] },
    { name: "Priya Raman", owner: ruth.id, rank: 4, priority: "medium", interval: 14, lastContactDaysAgo: 22, email: "priya.raman@example.com", note: "Came to the carol service and again in June. Brings her sister.", attendance: [2, 6, 10, 11, 14] },
    { name: "Ken Iwuji", owner: ruth.id, rank: 3, priority: "medium", interval: 14, lastContactDaysAgo: 21, note: "Visited once in July. Works most Sundays; looking at a shift swap.", attendance: [12] },
    { name: "Marta Kowalczyk", owner: ruth.id, rank: 5, priority: "medium", interval: 21, lastContactDaysAgo: 26, email: "marta.k@example.com", note: "Regular since Easter. Considering the Tuesday group.", attendance: [3, 5, 7, 8, 9, 11, 12, 13, 14, 15], away: [10] },
    { name: "Ade Balogun", owner: ruth.id, rank: 6, priority: "low", interval: 28, lastContactDaysAgo: 9, note: "Baptised in May. Steady.", attendance: [8, 9, 10, 11, 12, 13, 14, 15] },
    { name: "Chloe Bennett", owner: ruth.id, rank: 4, priority: "medium", interval: 14, lastContactDaysAgo: 11, phone: "07700 900771", note: "Comes with Priya. Quiet, stays for coffee.", attendance: [6, 10, 11, 14] },
    { name: "Yusuf Demir", owner: ruth.id, rank: 2, priority: "low", interval: 28, lastContactDaysAgo: 6, note: "Neighbour. Happy to talk, not ready to visit.", attendance: [] },
    { name: "Grace Mbeki", owner: ruth.id, rank: 7, priority: "low", interval: 28, lastContactDaysAgo: 3, note: "Serving on welcome since February.", attendance: [7, 8, 9, 10, 11, 12, 13, 14, 15] },
    { name: "Tom Reilly", owner: ruth.id, rank: 1, priority: "medium", interval: 21, lastContactDaysAgo: 13, note: "Met at the food bank. Sceptical but warm.", attendance: [] },
    { name: "Ana Lucia Silva", owner: ruth.id, rank: 5, priority: "medium", interval: 21, lastContactDaysAgo: 8, email: "ana.silva@example.com", note: "Moved from Porto in January. Regular now.", attendance: [9, 10, 12, 13, 14, 15] },
    { name: "Noah Fitzgerald", owner: ruth.id, rank: 3, priority: "low", interval: 28, lastContactDaysAgo: 19, note: "Came for the quiz night, stayed for the service after.", attendance: [11] },

    { name: "Ibrahim Sesay", owner: james.id, rank: 2, priority: "high", interval: 14, lastContactDaysAgo: 18, note: "Works nights. Best reached on a Thursday.", attendance: [] },
    { name: "Ellie Hartwell", owner: james.id, rank: 4, priority: "medium", interval: 14, lastContactDaysAgo: 5, attendance: [10, 12, 13, 15] },
    { name: "Kofi Mensah", owner: james.id, rank: 6, priority: "low", interval: 28, lastContactDaysAgo: 12, attendance: [8, 9, 11, 12, 13, 14, 15] },
    { name: "Rosa Delgado", owner: james.id, rank: 1, priority: "medium", interval: 21, lastContactDaysAgo: 30, attendance: [] },
    { name: "Michael Osei", owner: james.id, rank: 3, priority: "medium", interval: 14, lastContactDaysAgo: 16, attendance: [13] },

    { name: "Fatima Noor", owner: hannah.id, rank: 2, priority: "high", interval: 14, lastContactDaysAgo: 4, attendance: [] },
    { name: "Beth Calloway", owner: hannah.id, rank: 5, priority: "medium", interval: 21, lastContactDaysAgo: 24, attendance: [7, 9, 11, 13, 15] },
    { name: "Owen Pritchard", owner: hannah.id, rank: 3, priority: "low", interval: 28, lastContactDaysAgo: 7, attendance: [14] },
    { name: "Simone Aitken", owner: hannah.id, rank: 4, priority: "medium", interval: 14, lastContactDaysAgo: 2, attendance: [12, 14, 15] },
  ];

  const sun = sundays(16);

  for (const r of rows) {
    const lastContactAt = r.lastContactDaysAgo === null ? null : ago(r.lastContactDaysAgo);
    const person = await db.person.create({
      data: {
        name: r.name,
        ownerId: r.owner,
        statusRank: r.rank,
        priority: r.priority,
        intervalDays: r.interval,
        lastContactAt,
        phone: r.phone,
        email: r.email,
        createdAt: ago(120),
        createdById: r.owner,
        statusChangedAt: ago(30),
      },
    });

    if (lastContactAt) {
      await db.contact.create({
        data: { personId: person.id, happenedAt: lastContactAt, via: "logged" },
      });
    }

    if (r.note) {
      await db.note.create({
        data: {
          personId: person.id,
          authorId: r.owner,
          body: r.note,
          kind: "note",
          createdAt: lastContactAt ?? ago(20),
        },
      });
    }

    await db.note.create({
      data: {
        personId: person.id,
        authorId: r.owner,
        kind: "status_change",
        fromRank: Math.max(1, r.rank - 1),
        toRank: r.rank,
        body: "",
        createdAt: ago(30),
      },
    });

    for (const i of r.attendance ?? []) {
      await db.attendance.create({
        data: { personId: person.id, serviceDate: sun[i], state: "present" },
      });
    }
    for (const i of r.away ?? []) {
      await db.attendance.create({
        data: { personId: person.id, serviceDate: sun[i], state: "away" },
      });
    }
  }

  // A couple of meetings so the log is not empty on the first person opened.
  const daniel = await db.person.findFirst({ where: { name: "Daniel Okafor" } });
  if (daniel) {
    await db.meeting.createMany({
      data: [
        { personId: daniel.id, happenedOn: ago(15), kind: "coffee", minutes: 45, body: "Talked about his father's illness. He asked how anyone knows God is listening.", authorId: ruth.id },
        { personId: daniel.id, happenedOn: ago(38), kind: "call", minutes: 20, body: "Checked in after he missed the barbecue.", authorId: ruth.id },
        { personId: daniel.id, happenedOn: ago(66), kind: "meal", minutes: 90, body: "First proper conversation. He brought it up, not me.", authorId: ruth.id },
      ],
    });
  }

  console.log(
    `Seeded ${rows.length} people across ${[ruth, james, hannah].length} leaders.\n` +
      `Sign in with any of:\n` +
      `  ruth@example.com   (higher leader, 12 people, 5 overdue)\n` +
      `  james@example.com  (leader)\n` +
      `  hannah@example.com (leader)\n` +
      `  admin@example.com  (admin)\n` +
      `Password for all: tend-demo-2026`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
