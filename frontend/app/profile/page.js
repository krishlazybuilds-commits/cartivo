"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import Reveal from "../components/Reveal";
import PasswordInput from "../components/PasswordInput";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAuth, authFetch, extractError } from "../lib/auth";

function ProfileForm() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [info, setInfo] = useState({ username: "", first_name: "", last_name: "", phone: "" });
  const [infoMsg, setInfoMsg] = useState(null);
  const [infoErr, setInfoErr] = useState(null);
  const [infoSaving, setInfoSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "" });
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);

  // Email change state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailErr, setEmailErr] = useState(null);
  const [emailSaving, setEmailSaving] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteErr, setDeleteErr] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Handle email confirmation link: /profile?email_uid=...&email_token=...
  useEffect(() => {
    const uid = searchParams.get("email_uid");
    const token = searchParams.get("email_token");
    if (!uid || !token) return;
    authFetch("/auth/me/email/confirm/", {
      method: "POST",
      body: JSON.stringify({ uid, token }),
    })
      .then(() => {
        setEmailMsg("Email updated successfully.");
        // Remove query params without reload.
        router.replace("/profile");
      })
      .catch((err) => setEmailErr(extractError(err.data, err.message)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
    if (user) setInfo({
      username: user.username ?? "",
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      phone: user.phone ?? "",
    });
  }, [user, authLoading, router]);

  async function saveInfo(e) {
    e.preventDefault();
    setInfoMsg(null); setInfoErr(null); setInfoSaving(true);
    try {
      await authFetch("/auth/me/", { method: "PATCH", body: JSON.stringify(info) });
      setInfoMsg("Profile updated.");
    } catch (err) {
      setInfoErr(extractError(err.data, err.message));
    } finally {
      setInfoSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwMsg(null); setPwErr(null); setPwSaving(true);
    try {
      await authFetch("/auth/me/password/", { method: "POST", body: JSON.stringify(pwForm) });
      setPwMsg("Password changed. Please sign in again.");
      setPwForm({ current_password: "", new_password: "" });
      setTimeout(() => { logout(); router.push("/login"); }, 1500);
    } catch (err) {
      setPwErr(extractError(err.data, err.message));
    } finally {
      setPwSaving(false);
    }
  }

  async function requestEmailChange(e) {
    e.preventDefault();
    setEmailErr(null); setEmailMsg(null); setEmailSaving(true);
    try {
      await authFetch("/auth/me/email/", { method: "POST", body: JSON.stringify({ email: newEmail }) });
      setEmailMsg(`Confirmation sent to ${newEmail}. Check your inbox.`);
      setShowEmailForm(false);
      setNewEmail("");
    } catch (err) {
      setEmailErr(extractError(err.data, err.message));
    } finally {
      setEmailSaving(false);
    }
  }

  if (authLoading || !user) return null;

  async function deleteAccount() {
    setDeleting(true);
    setDeleteErr(null);
    try {
      await authFetch("/auth/me/", { method: "DELETE" });
      await logout();
      router.push("/");
    } catch (err) {
      setDeleteErr(extractError(err.data, err.message));
      setDeleting(false);
    }
  }

  return (
    <>
      <main>
        <section className="features">
          <div className="container">
            <Reveal>
              <div className="section-head">
                <span className="eyebrow">Account</span>
                <h2>Your profile</h2>
              </div>
            </Reveal>

            <Reveal delay={80}>
            <div style={{ display: "grid", gap: "2rem", maxWidth: 560 }}>
              {/* Profile info */}
              <div className="order-card">
                <h3 style={{ marginBottom: "1.25rem" }}>Personal information</h3>
                <form onSubmit={saveInfo} style={{ display: "grid", gap: "1rem" }}>
                  <label>
                    Username
                    <input value={info.username} onChange={e => setInfo(p => ({ ...p, username: e.target.value }))} required />
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <label>
                      First name
                      <input value={info.first_name} onChange={e => setInfo(p => ({ ...p, first_name: e.target.value }))} />
                    </label>
                    <label>
                      Last name
                      <input value={info.last_name} onChange={e => setInfo(p => ({ ...p, last_name: e.target.value }))} />
                    </label>
                  </div>
                  <label>
                    Phone
                    <input type="tel" value={info.phone} onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))} />
                  </label>
                  {infoMsg && <p className="auth-success">{infoMsg}</p>}
                  {infoErr && <p className="auth-error">{infoErr}</p>}
                  <button className="btn btn-primary" type="submit" disabled={infoSaving}>
                    {infoSaving ? "Saving…" : "Save changes"}
                  </button>
                </form>
              </div>

              {/* Email change */}
              <div className="order-card">
                <h3 style={{ marginBottom: "1.25rem" }}>Email address</h3>
                <p style={{ marginBottom: "1rem", opacity: 0.8 }}>
                  Current: <strong>{user.email}</strong>
                </p>
                {emailMsg && <p className="auth-success" style={{ marginBottom: "0.75rem" }}>{emailMsg}</p>}
                {emailErr && <p className="auth-error" style={{ marginBottom: "0.75rem" }}>{emailErr}</p>}
                {!showEmailForm ? (
                  <button className="btn btn-ghost" type="button" onClick={() => { setShowEmailForm(true); setEmailErr(null); setEmailMsg(null); }}>
                    Change email
                  </button>
                ) : (
                  <form onSubmit={requestEmailChange} style={{ display: "grid", gap: "0.75rem" }}>
                    <label>
                      New email address
                      <input
                        type="email"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        required
                        autoFocus
                        placeholder="new@example.com"
                      />
                    </label>
                    <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>
                      A confirmation link will be sent to the new address.
                    </p>
                    <div style={{ display: "flex", gap: "0.75rem" }}>
                      <button className="btn btn-primary" type="submit" disabled={emailSaving}>
                        {emailSaving ? "Sending…" : "Send confirmation"}
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => setShowEmailForm(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Password change */}
              <div className="order-card">
                <h3 style={{ marginBottom: "1.25rem" }}>Change password</h3>
                <form onSubmit={changePassword} style={{ display: "grid", gap: "1rem" }}>
                  <label>
                    Current password
                    <PasswordInput value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} autoComplete="current-password" required />
                  </label>
                  <label>
                    New password
                    <PasswordInput value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} autoComplete="new-password" required minLength={8} />
                  </label>
                  {pwMsg && <p className="auth-success">{pwMsg}</p>}
                  {pwErr && <p className="auth-error">{pwErr}</p>}
                  <button className="btn btn-primary" type="submit" disabled={pwSaving}>
                    {pwSaving ? "Saving…" : "Change password"}
                  </button>
                </form>
              </div>

              {/* Quick links */}
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <Link href="/orders" className="btn btn-ghost">View orders</Link>
                <button className="btn btn-ghost" type="button" onClick={logout}>Sign out</button>
              </div>

              {/* Danger zone */}
              <div className="order-card" style={{ borderColor: "var(--error, #dc2626)" }}>
                <h3 style={{ marginBottom: "0.5rem" }}>Danger zone</h3>
                <p style={{ fontSize: "0.875rem", marginBottom: "1rem", opacity: 0.7 }}>
                  Permanently deactivate your account. Your order and review history will be preserved.
                </p>
                {deleteErr && <p className="auth-error">{deleteErr}</p>}
                <button
                  className="btn btn-danger"
                  type="button"
                  disabled={deleting}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete account
                </button>
              </div>
            </div>
            </Reveal>

          </div>
        </section>
      </main>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete your account?"
        message="This will permanently deactivate your account. You won't be able to sign in again. Your order history will be preserved."
        confirmLabel="Delete account"
        destructive
        onConfirm={deleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileForm />
    </Suspense>
  );
}
