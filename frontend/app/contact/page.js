"use client";

import { useState } from "react";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { API_URL } from "../lib/api";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState(null); // "sending" | "success" | "error"

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch(`${API_URL}/contact/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      setForm({ name: "", email: "", message: "" });
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container" style={{ maxWidth: 720 }}>
            <div className="section-head">
              <span className="eyebrow">Get in touch</span>
              <h2>Contact us</h2>
              <p>Have a question or want to collaborate? Drop us a message.</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form" style={{ gap: "1rem" }}>
              <label>
                Name
                <input
                  type="text"
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  placeholder="Your email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </label>
              <label>
                Message
                <textarea
                  placeholder="Your message"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                  rows={6}
                  style={{ resize: "vertical", padding: "0.7rem 0.9rem", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, font: "inherit" }}
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Send message"}
              </button>
              {status === "success" && <p style={{ color: "green" }}>Message sent! We'll get back to you soon.</p>}
              {status === "error" && <p style={{ color: "red" }}>Something went wrong. Please try again.</p>}
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
