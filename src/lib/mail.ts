import nodemailer from "nodemailer";

/**
 * Gmail delivery. Set GMAIL_USER and GMAIL_APP_PASSWORD (a Google App
 * Password, not the account password). With neither set, mail is written to
 * the console so the reminder job is still testable offline.
 */

/**
 * Anything a person typed — their own name, a person's name, the church's —
 * goes through this before it is set in HTML. A name like `<a href=…>` must
 * arrive in the inbox as those characters, not as a link. Mail clients are not
 * relied on to do this for us.
 */
function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let cached: nodemailer.Transporter | null = null;

function transport() {
  if (cached) return cached;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  cached = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return cached;
}

export function mailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
  fromAddress?: string;
}) {
  const from = `${opts.fromName ?? "Tend"} <${opts.fromAddress ?? process.env.GMAIL_USER ?? "reminders@example.com"}>`;
  const t = transport();

  if (!t) {
    console.log(
      `\n[mail not configured — would have sent]\nTo: ${opts.to}\nFrom: ${from}\nSubject: ${opts.subject}\n\n${opts.text}\n`,
    );
    return { delivered: false as const };
  }

  await t.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
  return { delivered: true as const };
}

/** A leader asking someone to report to them. The link is the invitation. */
export function inviteEmail(opts: { inviterName: string; link: string; days: number }) {
  const { inviterName, link, days } = opts;
  const first = inviterName.split(" ")[0];
  const subject = `${inviterName} has invited you to their team on Tend`;

  const text =
    `${inviterName} has invited you to join their team on Tend, so they can see how the people you pray for are getting on.\n\n` +
    `Open this link to accept. If you don't have an account yet, you can create one there and you'll be on ${first}'s team straight away:\n\n` +
    `${link}\n\n` +
    `The link works for ${days} days. If you weren't expecting this, you can ignore it.\n\n` +
    `Tend`;

  const html = `<!doctype html>
<html><body style="margin:0;background:#EBEFE6;font-family:Archivo,'Segoe UI',Helvetica,Arial,sans-serif;color:#1A2018">
  <table role="presentation" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" style="width:100%;max-width:560px;background:#fff;border:1px solid #C2CBBA;border-radius:12px;border-collapse:separate;overflow:hidden">
      <tr><td style="background:#164A2E;color:#E9F0E6;padding:16px 24px;font-size:17px;font-weight:640;letter-spacing:-.02em">Tend</td></tr>
      <tr><td style="padding:24px">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
          <b>${esc(inviterName)}</b> has invited you to join their team on Tend, so they can see how the
          people you pray for are getting on.
        </p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.5">
          If you don't have an account yet, you can create one from the link and you'll be on
          ${esc(first)}'s team straight away.
        </p>
        <a href="${link}" style="display:inline-block;height:40px;line-height:40px;padding:0 18px;border-radius:8px;background:#164A2E;color:#E9F0E6;font-weight:640;text-decoration:none;font-size:15px">Accept the invitation</a>
        <p style="margin:20px 0 0;font-size:12px;color:#616C57;line-height:1.5;word-break:break-all">
          Or paste this into your browser:<br><a href="${link}" style="color:#215E7C">${link}</a>
        </p>
      </td></tr>
      <tr><td style="padding:12px 24px 20px;border-top:1px solid #D8DFD2;font-size:11px;color:#616C57;line-height:1.6">
        The link works for ${days} days. If you weren't expecting this, you can ignore it.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, text, html };
}

export type Overdue = { name: string; days: number; personId: string };

/** The reminder digest: one email per leader per day, never one per person. */
export function reminderEmail(opts: {
  leaderName: string;
  lead: Overdue;
  others: Overdue[];
  intervalWords: string;
  appUrl: string;
  sendHour: number;
  churchName: string;
}) {
  const { lead, others, intervalWords, appUrl, sendHour, churchName } = opts;
  const hour = `${String(sendHour).padStart(2, "0")}:00`;
  const subject = `You haven't contacted ${lead.name.split(" ")[0]} for ${intervalWords}`;

  const othersText = others.length
    ? `\n${others.length === 1 ? "One other is" : `${others.length} others are`} also waiting:\n` +
      others.map((o) => `  ${o.name} — ${o.days} days`).join("\n") +
      "\n"
    : "";

  const text =
    `You haven't contacted ${lead.name} for ${intervalWords}. That's ${lead.days === 1 ? "a day" : `${lead.days} days`} past the interval you set for them.\n` +
    othersText +
    `\nOpen your follow-ups: ${appUrl}/follow-ups\n\n` +
    `One email a day at ${hour}, and only when someone is overdue. Never on a Sunday.\n` +
    `${churchName} · Tend`;

  const othersHtml = others.length
    ? `<p style="margin:0 0 8px;color:#4E574A;font-size:13px">${
        others.length === 1 ? "One other is" : `${others.length} others are`
      } also waiting:</p>
       <table role="presentation" style="width:100%;border:1px solid #D8DFD2;border-radius:8px;border-collapse:separate;border-spacing:0;margin-bottom:24px">
         ${others
           .map(
             (o, i) =>
               `<tr><td style="padding:10px 12px;font-size:13px;font-weight:640;${i ? "border-top:1px solid #D8DFD2" : ""}">${esc(o.name)}</td>
                <td style="padding:10px 12px;font-size:13px;font-weight:640;color:#B3372A;text-align:right;${i ? "border-top:1px solid #D8DFD2" : ""}">${o.days} days</td></tr>`,
           )
           .join("")}
       </table>`
    : "";

  const html = `<!doctype html>
<html><body style="margin:0;background:#EBEFE6;font-family:Archivo,'Segoe UI',Helvetica,Arial,sans-serif;color:#1A2018">
  <table role="presentation" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" style="width:100%;max-width:560px;background:#fff;border:1px solid #C2CBBA;border-radius:12px;border-collapse:separate;overflow:hidden">
      <tr><td style="background:#164A2E;color:#E9F0E6;padding:16px 24px;font-size:17px;font-weight:640;letter-spacing:-.02em">Tend</td></tr>
      <tr><td style="padding:24px">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
          You haven't contacted <b>${esc(lead.name)}</b> for ${intervalWords}. That's
          ${lead.days === 1 ? "a day" : `${lead.days} days`} past the interval you set for them.
        </p>
        ${othersHtml}
        <a href="${appUrl}/follow-ups" style="display:inline-block;height:40px;line-height:40px;padding:0 18px;border-radius:8px;background:#164A2E;color:#E9F0E6;font-weight:640;text-decoration:none;font-size:15px">Open your follow-ups</a>
      </td></tr>
      <tr><td style="padding:12px 24px 20px;border-top:1px solid #D8DFD2;font-size:11px;color:#616C57;line-height:1.6">
        One email a day at ${hour}, and only when someone is overdue. Never on a Sunday.<br>
        ${esc(churchName)} · Tend · <a href="${appUrl}/admin/reminders" style="color:#215E7C">Change when these arrive</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, text, html };
}
