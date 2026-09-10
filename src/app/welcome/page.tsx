import Link from "next/link";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/permissions";
import { Icon } from "@/components/Icons";
import { FirstPerson } from "@/components/auth/FirstPerson";

export const metadata = { title: "First run — Tend" };

/** Nothing is configured before the first person exists. */
export default async function WelcomePage() {
  const viewer = await requireViewer();
  if (viewer.onboarded) redirect("/people");

  const wholeList = (
    <section className="sheet">
      <div className="sheet-head">
        <h2>Or a whole list</h2>
      </div>
      <div className="sheet-body">
        <p className="t-quiet">
          If you already keep names in a spreadsheet, bring the file. You’ll see the columns before
          anything is added.
        </p>
        <Link className="btn btn--ghost btn--wide mt-4" href="/add?tab=csv">
          <Icon name="upload" /> Import a CSV
        </Link>
      </div>
    </section>
  );

  return (
    <>
      {/* Desktop: no rail yet — the plot ground is the whole page. */}
      <div
        className="only-desk"
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <div className="topbar">
          <span className="crumb">
            <Icon name="mark" size="sm" /> <b>Tend</b>
          </span>
        </div>

        {/* One centred column, heading included, so the staircase gets the
            width it was drawn for and Skip and Add sit within reach of each
            other rather than at opposite ends of the screen. */}
        <div className="content plotground" style={{ flex: 1 }}>
          <div className="one-col">
            <div className="steps">
              <div className="step is-done">
                <span className="n">
                  <Icon name="check" size="sm" style={{ strokeWidth: 2.4 }} />
                </span>
                <span className="lbl">Your account</span>
              </div>
              <div className="step is-now">
                <span className="n num">2</span>
                <span className="lbl">Add your first person</span>
              </div>
            </div>

            <div className="page-head">
              <h1>Add the first person you’re praying for.</h1>
              <p className="sub">Just a name to start. Everything else can wait, and can change.</p>
            </div>

            <FirstPerson variant="desk" extra={wholeList} />
          </div>
        </div>
      </div>

      {/* Phone: one action, on the floor. */}
      <div className="m-app only-mob">
        <div className="m-top on-plot">
          <div className="m-steps">
            <i className="is-done" />
            <i className="is-now" />
          </div>
          <div className="m-sub" style={{ marginBottom: 6 }}>
            Step 2 of 2
          </div>
          <h1>Add your first person</h1>
          <div className="m-sub">Just a name to start.</div>
        </div>

        <FirstPerson variant="mob" />
      </div>
    </>
  );
}
