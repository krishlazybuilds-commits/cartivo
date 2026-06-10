import Nav from "../components/Nav";
import Footer from "../components/Footer";

export const metadata = {
  title: "Privacy Policy — Cartivo",
  description: "How Cartivo collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container" style={{ maxWidth: 720 }}>
            <div className="section-head">
              <span className="eyebrow">Legal</span>
              <h2>Privacy Policy</h2>
              <p>Last updated: June 2026</p>
            </div>

            <div className="legal-body">
              <h3>Information we collect</h3>
              <p>We collect information you provide when you register for an account, place an order, or contact us. This includes your name, email address, phone number, and shipping address.</p>

              <h3>How we use your information</h3>
              <p>We use the information we collect to process your orders, send order confirmations, provide customer support, and improve our services. We do not sell your personal information to third parties.</p>

              <h3>Data storage</h3>
              <p>Your data is stored securely on our servers. We use industry-standard encryption to protect your personal information during transmission and at rest.</p>

              <h3>Cookies</h3>
              <p>We use cookies and local storage to keep you signed in and remember your cart. We do not use tracking or advertising cookies.</p>

              <h3>Your rights</h3>
              <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us. You can also update your account information directly from your profile page.</p>

              <h3>Contact</h3>
              <p>If you have questions about this policy, please contact us at privacy@cartivo.com.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
