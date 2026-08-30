import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Icon } from "@/components/Icons";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Sign in — Tend" };

type Search = { register?: string };

/** The green panel publishes the whole colour key before anyone signs in. */
function Aside() {
  return (
    <aside className="auth-aside on-plot plotground-dk">
      <div className="rail-mark">
        <svg viewBox="0 0 24 24" strokeLinejoin="round">
          <use href="#ic-mark" />
        </svg>
        <b>Tend</b>
      </div>
      <p className="auth-line">Remember the people you’re praying for.</p>
      <p className="lede">
        A list of names, where each one stands, and a nudge when you haven’t spoken in a while.
      </p>
      <div className="auth-keys">
        <div>
          <i style={{ background: "#8FBF9C" }} /> Yours, and on time
        </div>
        <div>
          <i style={{ background: "#E07A6C" }} /> You haven’t spoken in a while
        </div>
        <div>
          <i style={{ background: "#D8B25E" }} /> Due in the next few days
        </div>
        <div>
          <i style={{ background: "#7FB4CC" }} /> Someone else’s list — read-only
        </div>
      </div>
    </aside>
  );
}

function Toggle({ mode, height }: { mode: "in" | "up"; height?: number }) {
  const style = { flex: 1, justifyContent: "center", height };
  return (
    <div className="seg mb-5" style={{ width: "100%" }}>
      <Link href="/sign-in" style={style} aria-current={mode === "in" ? "page" : undefined}>
        Sign in
      </Link>
      <Link
        href="/sign-in?register=1"
        style={style}
        aria-current={mode === "up" ? "page" : undefined}
      >
        Create an account
      </Link>
    </div>
  );
}

function Assurance({ centred }: { centred?: boolean }) {
  return (
    <p
      className="t-quiet mt-5"
      style={{ fontSize: ".8125rem", textAlign: centred ? "center" : undefined }}
    >
      <Icon
        name="lock"
        size="sm"
        style={{ display: "inline-block", verticalAlign: -3, strokeWidth: 1.7 }}
      />{" "}
      Your people are yours. Only a leader above you can read them.
    </p>
  );
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await auth();
  if (session?.user?.id) redirect("/");

  const { register } = await searchParams;
  const mode: "in" | "up" = register ? "up" : "in";
  const heading = mode === "in" ? "Sign in" : "Create an account";
  const lede =
    mode === "in"
      ? "Welcome back, whoever you are today."
      : "An admin sets what you can see once you’re in.";

  return (
    <>
      {/* Desktop: green panel, white form. */}
      <div className="auth only-desk">
        <Aside />
        <main className="auth-main">
          <div className="auth-form">
            <Toggle mode={mode} />
            <h2>{heading}</h2>
            <p className="lede">{lede}</p>
            <AuthForm key={mode} mode={mode} variant="desk" />
            <p className="auth-alt">
              {mode === "in" ? (
                <>
                  No account yet? <Link href="/sign-in?register=1">Create one</Link>
                </>
              ) : (
                <>
                  Already have one? <Link href="/sign-in">Sign in</Link>
                </>
              )}
            </p>
            <Assurance centred />
          </div>
        </main>
      </div>

      {/* Phone: the form rides up over the green as a white sheet. */}
      <div className="m-app only-mob" style={{ background: "var(--plot)" }}>
        <div className="m-top on-plot plotground-dk" style={{ padding: "8px 20px 26px" }}>
          <div className="rail-mark" style={{ padding: "0 0 18px" }}>
            <svg viewBox="0 0 24 24" strokeLinejoin="round">
              <use href="#ic-mark" />
            </svg>
            <b>Tend</b>
          </div>
          <h1 style={{ maxWidth: "13ch" }}>Remember the people you’re praying for.</h1>
        </div>

        <AuthForm
          key={mode}
          mode={mode}
          variant="mob"
          head={
            <>
              <Toggle mode={mode} height={38} />
              <h2 style={{ fontSize: "1.375rem", fontWeight: 640, letterSpacing: "-.025em" }}>
                {heading}
              </h2>
              <p className="t-quiet mb-5" style={{ fontSize: ".8125rem" }}>
                {lede}
              </p>
            </>
          }
          foot={<Assurance />}
        />
      </div>
    </>
  );
}
