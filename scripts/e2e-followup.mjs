import puppeteer from "puppeteer-core";
import { PrismaClient } from "./src/generated/prisma/index.js";

const db = new PrismaClient();
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
page.on("console", (m) => {
  if (m.type() === "error") console.log("  [console]", m.text().slice(0, 220));
});
page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 220)));
page.on("response", (r) => {
  if (r.status() >= 400) console.log("  [http]", r.status(), r.url().slice(0, 90));
});
await page.setViewport({ width: 1440, height: 1000 });

await page.goto("http://localhost:3000/sign-in", { waitUntil: "networkidle0" });
await page.type("input[type=email]", "ruth@example.com");
await page.type("input[type=password]", "tend-demo-2026");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
  page.click("button[type=submit]"),
]);
await page.goto("http://localhost:3000/follow-ups", { waitUntil: "networkidle0" });

const cols = await page.$$eval(".fu-colhead h2", (els) => els.map((e) => e.textContent.trim()));
const before = await page.$$eval(".fu-cols .fu .fu-name", (els) =>
  els.map((e) => e.textContent.trim()),
);
console.log("columns:", cols.join(" | "));
console.log("cards before:", before.join(", ") || "(none)");

const target = before[0];
const meetingsBefore = await db.meeting.count();

await page.click(".fu-cols .fu button");
await page.waitForSelector(".fup-form", { timeout: 5000 });
console.log("form opened:", await page.$eval(".fup-head .label", (e) => e.textContent.trim()));
const fields = await page.$$eval(".fup-form .fup-field > .label", (els) =>
  els.map((e) => e.textContent.trim()),
);
console.log("fields:", fields.join(" · "));

await page.type("input[name=place]", "His kitchen");
await page.select("select[name=kind]", "meal");
await page.type("textarea[name=body]", "Talked about the shift swap. Asked what happens at a service.");
await page.click(".fup-foot button[type=submit]");
await new Promise((r) => setTimeout(r, 4000));

const err = await page.$eval(".err", (e) => e.textContent.trim()).catch(() => null);
console.log("form error shown:", err ?? "none");
console.log("form still open:", (await page.$(".fup-form")) ? "yes" : "no");
const bodyTxt = await page.$eval("body", (e) => e.innerText.slice(0, 150));
console.log("page reads:", bodyTxt.replace(/\s+/g, " "));

const after = await page.$$eval(".fu-cols .fu .fu-name", (els) =>
  els.map((e) => e.textContent.trim()),
);
console.log("cards after:", after.join(", ") || "(none)");
console.log("meetings:", meetingsBefore, "->", await db.meeting.count());

const m = await db.meeting.findFirst({ orderBy: { createdAt: "desc" }, include: { person: true } });
console.log(
  "newest meeting:",
  JSON.stringify({
    person: m.person.name,
    when: m.happenedOn.toISOString().slice(0, 10),
    kind: m.kind,
    place: m.place,
    notes: m.body?.slice(0, 50),
  }),
);
console.log("target left the column:", !after.includes(target));

await page.screenshot({ path: "followups-desktop.png", fullPage: true });
await page.setViewport({ width: 390, height: 850 });
await page.goto("http://localhost:3000/follow-ups", { waitUntil: "networkidle0" });
await page.screenshot({ path: "followups-mobile.png", fullPage: true });

await browser.close();
await db.$disconnect();
