import Nav from "../components/Nav";
import Footer from "../components/Footer";
import Reveal from "../components/Reveal";

export const metadata = {
  title: "Terms of Service — Cartivo",
  description: "Terms and conditions governing the use of the Cartivo platform.",
};

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container" style={{ maxWidth: 720 }}>
            <Reveal>
              <div className="section-head">
                <span className="eyebrow">Legal</span>
                <h2>Terms of Service</h2>
                <p>Last updated: June 2026</p>
              </div>
            </Reveal>

            <Reveal delay={80}>
            <div className="legal-body">
              <h3>Acceptance of terms</h3>
              <p>By accessing or using Cartivo, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>

              <h3>Use of the platform</h3>
              <p>Cartivo is a demo e-commerce platform currently in early access. You may browse products, create an account, and place orders for demonstration purposes. No real payments are processed.</p>

              <h3>Accounts</h3>
              <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.</p>

              <h3>Orders</h3>
              <p>Orders placed on Cartivo are for demonstration purposes only. No actual goods will be shipped and no payment will be charged. Order data may be reset at any time.</p>

              <h3>Intellectual property</h3>
              <p>All content, logos, and trademarks on this platform are the property of Cartivo. You may not reproduce or distribute any content without written permission.</p>

              <h3>Limitation of liability</h3>
              <p>Cartivo is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from your use of the platform.</p>

              <h3>Changes to terms</h3>
              <p>We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>

              <h3>Contact</h3>
              <p>For questions about these terms, contact us at legal@cartivo.com.</p>
            </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
