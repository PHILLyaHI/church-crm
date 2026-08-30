"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/Icons";
import { registerAction, signInAction, type AuthState } from "@/app/sign-in/actions";

type Props = {
  mode: "in" | "up";
  /** Desktop: a form on the white panel. Phone: the white sheet itself. */
  variant: "desk" | "mob";
  /** Phone only: what sits above the fields inside the sheet. */
  head?: React.ReactNode;
  /** Phone only: what sits under them. */
  foot?: React.ReactNode;
};

const SHEET_ID = "auth-sheet";

export function AuthForm({ mode, variant, head, foot }: Props) {
  const register = mode === "up";
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    register ? registerAction : signInAction,
    null,
  );
  // Controlled, so a rejected attempt does not empty what they typed.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const err = (field: "name" | "email" | "password" | "confirm") =>
    state?.field === field ? state.message : null;
  const inputClass = (field: "name" | "email" | "password" | "confirm") =>
    err(field) ? "input is-error" : "input";
  const label = register ? "Create account" : "Sign in";

  const fields = (
    <>
      {register && (
        <label className="field">
          <span className="label">Your name</span>
          <input
            className={inputClass("name")}
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          {err("name") && <span className="err">{err("name")}</span>}
        </label>
      )}

      <label className="field">
        <span className="label">Email</span>
        <input
          className={inputClass("email")}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {err("email") && <span className="err">{err("email")}</span>}
      </label>

      <label className="field">
        <span className="label">Password</span>
        <span className="pw">
          <input
            className={inputClass("password")}
            type={show ? "text" : "password"}
            name="password"
            autoComplete={register ? "new-password" : "current-password"}
            placeholder={register ? "At least 8 characters" : undefined}
            required
          />
          <button
            className="pw-eye"
            type="button"
            aria-label={show ? "Hide password" : "Show password"}
            onClick={() => setShow((s) => !s)}
          >
            <Icon name="eye" />
          </button>
        </span>
        {err("password") ? (
          <span className="err">{err("password")}</span>
        ) : register ? (
          <span className="hint">At least 8 characters. A short sentence works well.</span>
        ) : null}
      </label>

      {register && (
        <label className="field">
          <span className="label">Confirm password</span>
          <span className="pw">
            <input
              className={inputClass("confirm")}
              type={showConfirm ? "text" : "password"}
              name="confirm"
              autoComplete="new-password"
              placeholder="Type it again"
              required
            />
            <button
              className="pw-eye"
              type="button"
              aria-label={showConfirm ? "Hide password" : "Show password"}
              onClick={() => setShowConfirm((s) => !s)}
            >
              <Icon name="eye" />
            </button>
          </span>
          {err("confirm") && <span className="err">{err("confirm")}</span>}
        </label>
      )}
    </>
  );

  if (variant === "mob") {
    return (
      <>
        <form
          id={SHEET_ID}
          className="m-auth"
          action={formAction}
          style={{ paddingBottom: 112 }}
        >
          {head}
          {fields}
          {foot}
        </form>
        <div className="m-thumb m-thumb--low on-sheet">
          <button
            className="btn btn--primary"
            type="submit"
            form={SHEET_ID}
            data-pending={pending ? "true" : undefined}
          >
            {label}
          </button>
        </div>
      </>
    );
  }

  return (
    <form action={formAction}>
      {fields}
      <button
        className="btn btn--primary btn--wide mt-4"
        type="submit"
        data-pending={pending ? "true" : undefined}
      >
        {label}
      </button>
    </form>
  );
}
