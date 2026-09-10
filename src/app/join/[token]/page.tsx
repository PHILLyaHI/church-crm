import Link from "next/link";
import { auth } from "@/auth";
import { Icon } from "@/components/Icons";
import { db } from "@/lib/db";
import { lookupInvite } from "@/lib/team";
import { acceptInviteAction } from "@/app/team/actions";

export const metadata = { title: "Join a team — Tend" };

type Params = Promise<{ token: string }>;
type Search = Promise<{ err?: string }>;

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="join plotground">
      <section className="sheet">
        <div className="sheet-head">
          <span className="rail-mark" style={{ padding: 0, color: "var(--plot)" }}>
            <svg viewBox="0 0 24 24" strokeLinejoin="round">
              <use href="#ic-mark" />
            </svg>
            <b>Tend</b>
          </span>
        </div>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}

/**
 * Where an invitation link lands. Signed out, it offers the two ways in;
 * signed in, one button joins the team. Whatever the state, the page says
 * plainly what this link is and who sent it.
 */
export default async function JoinPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { token } = await params;
  const { err } = await searchParams;
  const found = await lookupInvite(token);

  if (!found.invite) {
    return (
      <Card>
        <h2 className="join-h">This invitation does not exist.</h2>
        <p className="t-quiet mt-2">The link may have been copied wrongly, or taken back by whoever sent it.</p>
        <Link className="btn btn--ghost mt-5" href="/sign-in">Go to sign in</Link>
      </Card>
    );
  }

  const { invite } = found;
  const inviter = invite.inviter.name;
  const first = inviter.split(" ")[0];

  const session = await auth();
  const viewer = session?.user?.id
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, role: true, leaderId: true, onboardedAt: true },
      })
    : null;

  // The one happy ending: this invitation is theirs and it is done.
  const joined = viewer && (invite.acceptedById === viewer.id || viewer.leaderId === invite.inviterId);
  if (joined) {
    return (
      <Card>
        <span className="flag flag--ok"><Icon name="check" size="sm" /> Done</span>
        <h2 className="join-h mt-3">You are on {first}&rsquo;s team.</h2>
        <p className="t-quiet mt-2">
          {inviter} can now read the people on your list — and only read. Nothing of theirs is shown to you.
        </p>
        <Link className="btn btn--primary mt-5" href={viewer.onboardedAt ? "/people" : "/welcome"}>
          {viewer.onboardedAt ? "Open your people" : "Add your first person"}
        </Link>
      </Card>
    );
  }

  if (found.problem === "used") {
    return (
      <Card>
        <h2 className="join-h">This invitation has already been used.</h2>
        <p className="t-quiet mt-2">Ask {first} to send you a new one.</p>
        <Link className="btn btn--ghost mt-5" href="/sign-in">Go to sign in</Link>
      </Card>
    );
  }
  if (found.problem === "expired") {
    return (
      <Card>
        <h2 className="join-h">This invitation has expired.</h2>
        <p className="t-quiet mt-2">Links work for 14 days. Ask {first} to send you a new one.</p>
        <Link className="btn btn--ghost mt-5" href="/sign-in">Go to sign in</Link>
      </Card>
    );
  }

  if (!viewer) {
    return (
      <Card>
        <span className="label">An invitation</span>
        <h2 className="join-h mt-2">{inviter} has invited you to their team.</h2>
        <p className="t-quiet mt-2">
          Being on {first}&rsquo;s team means they can read the people on your list, so they can see how
          things are going. They cannot change anything, and you see nothing of theirs.
        </p>
        <Link className="btn btn--primary btn--wide mt-5" href={`/sign-in?register=1&invite=${invite.token}`}>
          Create an account and join
        </Link>
        <Link className="btn btn--ghost btn--wide mt-3" href={`/sign-in?invite=${invite.token}`}>
          I already have an account
        </Link>
      </Card>
    );
  }

  const blocked =
    viewer.id === invite.inviterId
      ? "That is your own invitation. Send the link to them."
      : viewer.role === "admin"
        ? "You are an admin. Admins read every list already, so they cannot join a team."
        : null;

  return (
    <Card>
      <span className="label">An invitation</span>
      <h2 className="join-h mt-2">{inviter} has invited you to their team.</h2>
      <p className="t-quiet mt-2">
        Say yes and {first} can read the people on your list — read only, and the screen always says
        the list is yours. You see nothing of theirs.
      </p>
      {(err || blocked) && (
        <div className="banner banner--warn mt-4">
          <span>{blocked ?? err}</span>
        </div>
      )}
      {!blocked && (
        <form action={acceptInviteAction} className="mt-5">
          <input type="hidden" name="token" value={invite.token} />
          <button className="btn btn--primary btn--wide" type="submit">
            <Icon name="check" size="sm" /> Join {first}&rsquo;s team as {viewer.name}
          </button>
        </form>
      )}
      <Link className="btn btn--quiet btn--wide mt-3" href="/people">Not now</Link>
    </Card>
  );
}
