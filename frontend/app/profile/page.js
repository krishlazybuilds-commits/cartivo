"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Reveal from "../components/Reveal";
import PasswordInput from "../components/PasswordInput";
import { useAuth, authFetch, extractError } from "../lib/auth";

export default function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [info, setInfo] = useState({ username: "", email: "", first_name: "", last_name: "", phone: "" });
  const [infoMsg, setInfoMsg] = useState(null);
  const [infoErr, setInfoErr] = useState(null);
  const [infoSaving, setInfoSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "" });
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
    if (user) setInfo({
      username: user.username ?? "",
      email: user.email ?? "",
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

  if (authLoading || !user) return null;

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
                    Email
                    <input type="email" value={info.email} onChange={e => setInfo(p => ({ ...p, email: e.target.value }))} />
                  </label>
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
            </div>
            </Reveal>

          </div>
        </section>
      </main>
    </>
  );
}
