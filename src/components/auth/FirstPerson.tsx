"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@/components/Icons";
import { INTERVAL_CHOICES, LADDER } from "@/lib/status";
import { span } from "@/lib/dates";
import { addFirstPerson, skipFirstRun } from "@/app/welcome/actions";

function everyLabel(days: number) {
  if (days === 7) return "Every week";
  if (days === 28) return "Every month";
  if (days % 7 === 0) return `Every ${days / 7} weeks`;
  return `Every ${days} days`;
}

function Add({ name, className }: { name: string; className: string }) {
  const { pending } = useFormStatus();
  const first = name.trim().split(/\s+/)[0];
  return (
    <button
      className={className}
      type="submit"
      disabled={!name.trim()}
      data-pending={pending ? "true" : undefined}
    >
      <Icon name="plus" /> Add {first || "them"}
    </button>
  );
}

function Skip({ className }: { className: string }) {
  return (
    <button className={className} type="submit" formAction={skipFirstRun} formNoValidate>
      Skip for now
    </button>
  );
}

type Props = {
  variant: "desk" | "mob";
  /** Desktop only: what sits in the right column. */
  extra?: React.ReactNode;
};

export function FirstPerson({ variant, extra }: Props) {
  const [name, setName] = useState("");
  const [rank, setRank] = useState(2);
  const [every, setEvery] = useState(14);

  const carried = (
    <>
      <input type="hidden" name="rank" value={rank} />
      <input type="hidden" name="interval" value={every} />
    </>
  );

  const chips = INTERVAL_CHOICES.map((days) => (
    <button
      key={days}
      className="fchip"
      type="button"
      aria-pressed={days === every}
      onClick={() => setEvery(days)}
    >
      {everyLabel(days)}
    </button>
  ));

  if (variant === "mob") {
    return (
      <form className="m-scroll plotground" action={addFirstPerson}>
        {carried}

        <label className="field">
          <span className="label">Their name</span>
          <input
            className="input"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ height: 60, fontSize: "1.25rem" }}
            required
          />
        </label>

        <span className="label" style={{ display: "block", margin: "0 0 8px 2px" }}>
          Where are they now?
        </span>
        <div className="m-sheet mb-5">
          {LADDER.map((s) => (
            <button
              key={s.rank}
              className="m-row obstep"
              type="button"
              aria-pressed={s.rank === rank}
              onClick={() => setRank(s.rank)}
              style={{ width: "100%", border: 0, background: "none", textAlign: "left" }}
            >
              <span className="rk num">{s.rank}</span>
              <span className="grow">{s.name}</span>
              <Icon name="check" size="sm" className="tick" style={{ strokeWidth: 2.2 }} />
            </button>
          ))}
        </div>

        <span className="label" style={{ display: "block", margin: "0 0 8px 2px" }}>
          How often will you be in touch?
        </span>
        <div className="interval mb-5">{chips}</div>

        <div className="banner banner--ok mb-4">
          <Icon name="mail" />
          <span>
            If {span(every)} pass without contact, you get one email. Never on a Sunday.
          </span>
        </div>

        <p style={{ textAlign: "center" }}>
          <Skip className="btn btn--quiet" />
        </p>

        <div className="m-thumb m-thumb--low">
          <Add name={name} className="btn btn--primary" />
        </div>
      </form>
    );
  }

  return (
    <>
      <section className="sheet">
        <div className="sheet-body">
          <form action={addFirstPerson}>
            {carried}

            <label className="field">
              <span className="label">Their name</span>
              <input
                className="input"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ fontSize: "1.25rem", height: 58 }}
                required
              />
            </label>

            <div className="field">
              <span className="label" style={{ display: "block", marginBottom: 8 }}>
                Where are they now?
              </span>
              <div className="ladder-rows">
                {LADDER.map((s) => (
                  <button
                    key={s.rank}
                    className={s.rank < rank ? "done" : undefined}
                    type="button"
                    aria-pressed={s.rank === rank}
                    onClick={() => setRank(s.rank)}
                  >
                    <span className="rk num">{s.rank}</span>
                    <span className="nm">{s.name}</span>
                    <Icon name="check" size="sm" className="tick" />
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="label" style={{ display: "block", marginBottom: 8 }}>
                How often will you be in touch?
              </span>
              <div className="interval">{chips}</div>
            </div>

            <div className="row mt-5">
              <Skip className="btn btn--quiet" />
              <Add name={name} className="btn btn--primary push" />
            </div>
          </form>
        </div>
      </section>

      <div>{extra}</div>
    </>
  );
}
