import Link from "next/link";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import Reveal from "../components/Reveal";

export const metadata = {
  title: "About — Cartivo",
  description: "Learn about Cartivo, our mission, and the team behind the platform.",
};

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container" style={{ maxWidth: 720 }}>
            <Reveal>
              <div className="section-head">
                <span className="eyebrow">Our story</span>
                <h2>About Cartivo</h2>
                <p>Built for independent brands who just want to sell.</p>
              </div>
            </Reveal>

            <Reveal delay={80}>
            <div className="legal-body">
              <h3>What is Cartivo?</h3>
              <p>Cartivo is a modern e-commerce storefront built to give independent brands a fast, clean shopping experience without the complexity of enterprise platforms. Browse a real product catalog, add items to your cart, and check out — all in seconds.</p>

              <h3>Why we built it</h3>
              <p>Most small shops are stuck choosing between platforms that are too simple or too expensive. We wanted to build something in between — powerful enough to handle a real store, simple enough that you can set it up in an afternoon.</p>

              <h3>The stack</h3>
              <p>Cartivo is built on a Django REST Framework backend with a Next.js 14 frontend. Payments are handled by Stripe. Authentication uses httpOnly JWT cookies for security. The entire codebase is open and straightforward to extend.</p>

              <h3>Early access</h3>
              <p>Cartivo is currently in early access. The product catalog, orders, and checkout are fully functional. We are actively adding features — pagination, email notifications, and an admin dashboard are on the roadmap.</p>

              <h3>Get in touch</h3>
              <p>Have a question or want to collaborate? Reach us at <a href="mailto:hello@cartivo.com">hello@cartivo.com</a> or browse the <Link href="/products">shop</Link> to see it in action.</p>
            </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
