"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import AuthPanel from "../components/AuthPanel";
import AuthBackButton from "../components/AuthBackButton";
import { useAuth } from "../lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function validate(form) {
  const errs = {};
  if (!USERNAME_RE.test(form.username))
    errs.username = "3–20 characters, letters, numbers and underscores only.";
  if (form.email && !EMAIL_RE.test(form.email))
    errs.email = "Enter a valid email address.";
  if (form.password.length < 8)
    errs.password = "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(form.password))
    errs.password = "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(form.password))
    errs.password = "Password must contain at least one number.";
  if (form.password !== form.confirmPassword)
    errs.confirmPassword = "Passwords do not match.";
  return errs;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    username: "", email: "", password: "", confirmPassword: "",
    first_name: "", last_name: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field) {
    return (e) => {
      const value = e.target.value;
      setForm((f) => ({ ...f, [field]: value }));
      // Clear field error on change
      setFieldErrors((fe) => ({ ...fe, [field]: undefined }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError(null);
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      const { confirmPassword, ...payload } = form;
      await register(payload);
      router.push("/products");
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-split">
      <div className="auth-split-form">
        <div className="auth-split-inner">
          <AuthBackButton />
          <div className="auth-split-head">
            <h1>Create your account</h1>
            <p>Join Cartivo and start shopping today.</p>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            {serverError && <p className="auth-error" role="alert">{serverError}</p>}
            <label>
              Username
              <input type="text" value={form.username} onChange={update("username")} autoComplete="username" required />
              {fieldErrors.username && <span className="auth-field-error">{fieldErrors.username}</span>}
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={update("email")} autoComplete="email" />
              {fieldErrors.email && <span className="auth-field-error">{fieldErrors.email}</span>}
            </label>
            <div className="auth-row">
              <label>
                First name
                <input type="text" value={form.first_name} onChange={update("first_name")} autoComplete="given-name" />
              </label>
              <label>
                Last name
                <input type="text" value={form.last_name} onChange={update("last_name")} autoComplete="family-name" />
              </label>
            </div>
            <label>
              Password
              <input type="password" value={form.password} onChange={update("password")} autoComplete="new-password" required />
              {fieldErrors.password && <span className="auth-field-error">{fieldErrors.password}</span>}
            </label>
            <label>
              Confirm password
              <input type="password" value={form.confirmPassword} onChange={update("confirmPassword")} autoComplete="new-password" required />
              {fieldErrors.confirmPassword && <span className="auth-field-error">{fieldErrors.confirmPassword}</span>}
            </label>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </button>
            <p className="auth-alt">Already have an account? <Link href="/login">Sign in</Link></p>
          </form>
        </div>
      </div>
      <AuthPanel />
    </main>
  );
}
