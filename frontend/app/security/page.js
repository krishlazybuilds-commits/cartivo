import Reveal from "../components/Reveal";

export const metadata = {
  title: "Security — Cartivo",
  description: "How Cartivo keeps your account and payment information secure.",
  alternates: {
    canonical: "/security",
  },
};

export default function SecurityPage() {
  return (
    <>
      <main>
        <section className="features">
          <div className="container" style={{ maxWidth: 720 }}>
            <Reveal>
              <div className="section-head">
                <span className="eyebrow">Trust & Safety</span>
                <h2>Security</h2>
                <p>Last updated: June 2026</p>
              </div>
            </Reveal>

            <Reveal delay={80}>
            <div className="legal-body">
              <h3>Authentication</h3>
              <p>Cartivo uses JSON Web Tokens (JWT) stored in httpOnly, Secure cookies. This means your session token is never accessible to JavaScript, protecting you from cross-site scripting (XSS) attacks. All authentication requests are protected with CSRF tokens.</p>

              <h3>Payments</h3>
              <p>Payments are processed entirely by <a href="https://stripe.com" target="_blank" rel="noopener noreferrer">Stripe</a>, a PCI-DSS Level 1 certified payment processor. Cartivo never stores, transmits, or has access to your card details. All payment pages are served over HTTPS.</p>

              <h3>Data in transit</h3>
              <p>All communication between your browser and Cartivo servers is encrypted using TLS (HTTPS). Unencrypted connections are redirected automatically.</p>

              <h3>Data at rest</h3>
              <p>Your personal data — name, email, shipping addresses, and order history — is stored in a secured database. Passwords are hashed using Django&apos;s PBKDF2 algorithm with a SHA-256 hash and are never stored in plain text.</p>

              <h3>Refresh token rotation</h3>
              <p>Every time your session is refreshed, the previous refresh token is blacklisted and a new one is issued. This limits the window of exposure if a token were ever compromised.</p>

              <h3>Responsible disclosure</h3>
              <p>If you discover a security vulnerability in Cartivo, please report it responsibly by emailing <a href="mailto:security@cartivo.com">security@cartivo.com</a>. We will acknowledge your report within 48 hours and work to resolve confirmed issues promptly.</p>

              <h3>Contact</h3>
              <p>For security-related questions or concerns, contact us at <a href="mailto:security@cartivo.com">security@cartivo.com</a>.</p>
            </div>
            </Reveal>
          </div>
        </section>
      </main>
    </>
  );
}
