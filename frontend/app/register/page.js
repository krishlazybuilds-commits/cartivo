"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import AuthPanel from "../components/AuthPanel";
import AuthBackButton from "../components/AuthBackButton";
import GoogleButton from "../components/GoogleButton";
import { useAuth } from "../lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

function validateStep1(form) {
  const errs = {};
  if (!form.email || !EMAIL_RE.test(form.email))
    errs.email = "Enter a valid email address.";
  if (form.password.length < 8)
    errs.password = "Password must be at least 8 characters.";
  else if (!/[A-Z]/.test(form.password))
    errs.password = "Password must contain at least one uppercase letter.";
  else if (!/[0-9]/.test(form.password))
    errs.password = "Password must contain at least one number.";
  if (form.password !== form.confirmPassword)
    errs.confirmPassword = "Passwords do not match.";
  if (!form.agreed)
    errs.agreed = "You must agree to the Terms of Service and Privacy Policy.";
  return errs;
}

function validateStep2(form) {
  const errs = {};
  if (!USERNAME_RE.test(form.username))
    errs.username = "3–20 characters, letters, numbers and underscores only.";
  if (form.phone) {
    const digits = form.phone.replace(/\D/g, "");
    if (!PHONE_RE.test(form.phone) || digits.length < 7 || digits.length > 15)
      errs.phone = "Enter a valid phone number.";
  }
  return errs;
}

function EyeIcon({ open }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s ease", transform: open ? "scale(1)" : "scale(0.9)" }}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" style={{ opacity: open ? 1 : 0, transition: "opacity 0.2s ease" }} />
      <circle cx="12" cy="12" r="3" style={{ opacity: open ? 1 : 0, transition: "opacity 0.2s ease" }} />
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" style={{ opacity: open ? 0 : 1, transition: "opacity 0.2s ease" }} />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" style={{ opacity: open ? 0 : 1, transition: "opacity 0.2s ease" }} />
      <line x1="1" y1="1" x2="23" y2="23" style={{ opacity: open ? 0 : 1, transition: "opacity 0.2s ease" }} />
    </svg>
  );
}

function PasswordInput({ value, onChange, autoComplete, required }) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-password-wrap">
      <input type={show ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete} required={required} />
      <button type="button" className="auth-password-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [sliding, setSliding] = useState(false);
  const [form, setForm] = useState({
    username: "", email: "", phone: "", password: "", confirmPassword: "",
    first_name: "", last_name: "", agreed: false,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setFieldErrors((fe) => ({ ...fe, [field]: undefined }));
    };
  }

  function handleStep1(e) {
    e.preventDefault();
    const errs = validateStep1(form);
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setSliding(true);
    setTimeout(() => { setStep(2); setSliding(false); }, 350);
  }

  async function handleStep2(e) {
    e.preventDefault();
    setServerError(null);
    const errs = validateStep2(form);
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setSubmitting(true);
    try {
      const { confirmPassword, agreed, ...payload } = form;
      await register(payload);
      router.push("/products");
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function goBack() {
    setFieldErrors({});
    setServerError(null);
    setSliding(true);
    setTimeout(() => { setStep(1); setSliding(false); }, 350);
  }

  const panelClass = `auth-split-form${sliding ? " auth-step-sliding" : step === 2 ? " auth-step-2" : ""}`;

  return (
    <main className="auth-split">
      <div className={panelClass}>
        <div className="auth-split-inner">

          {/* Step 1 */}
          {step === 1 && (
            <>
              <AuthBackButton />
              <div className="auth-split-head">
                <h1>Create your account</h1>
                <p>Join Cartivo and start shopping today.</p>
              </div>
              <form className="auth-form" onSubmit={handleStep1}>
                <label>
                  Email
                  <input type="email" value={form.email} onChange={update("email")} autoComplete="email" required />
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
                  <PasswordInput value={form.password} onChange={update("password")} autoComplete="new-password" required />
                  {fieldErrors.password && <span className="auth-field-error">{fieldErrors.password}</span>}
                </label>
                <label>
                  Confirm password
                  <PasswordInput value={form.confirmPassword} onChange={update("confirmPassword")} autoComplete="new-password" required />
                  {fieldErrors.confirmPassword && <span className="auth-field-error">{fieldErrors.confirmPassword}</span>}
                </label>
                <label className="auth-checkbox-label">
                  <input type="checkbox" checked={form.agreed} onChange={(e) => { setForm((f) => ({ ...f, agreed: e.target.checked })); setFieldErrors((fe) => ({ ...fe, agreed: undefined })); }} />
                  I agree to the <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>
                </label>
                {fieldErrors.agreed && <span className="auth-field-error">{fieldErrors.agreed}</span>}
                <button className="btn btn-primary" type="submit">Continue</button>
                <div className="auth-divider"><span>or</span></div>
                <GoogleButton action="Sign up" />
                {searchParams.get("next") === "/checkout" && (
                  <Link href="/checkout" className="btn btn-ghost" style={{ textAlign: "center", display: "block" }}>
                    Continue as guest
                  </Link>
                )}
                <p className="auth-alt">Already have an account? <Link href="/login">Sign in</Link></p>
              </form>
            </>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <>
              <button type="button" className="auth-back" onClick={goBack} aria-label="Go back">
                <svg className="auth-back-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back
              </button>
              <div className="auth-split-head">
                <h1>Almost there!</h1>
                <p>Pick a username and add your phone number.</p>
              </div>
              <form className="auth-form" onSubmit={handleStep2}>
                {serverError && <p className="auth-error" role="alert">{serverError}</p>}
                <label>
                  Username
                  <input type="text" value={form.username} onChange={update("username")} autoComplete="username" required autoFocus />
                  {fieldErrors.username && <span className="auth-field-error">{fieldErrors.username}</span>}
                </label>
                <label>
                  Phone <span className="auth-optional">(optional)</span>
                  <input type="tel" value={form.phone} onChange={update("phone")} autoComplete="tel" inputMode="tel" placeholder="+1 555 123 4567" />
                  {fieldErrors.phone && <span className="auth-field-error">{fieldErrors.phone}</span>}
                </label>
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? "Creating account…" : "Create account"}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
      <AuthPanel />
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
