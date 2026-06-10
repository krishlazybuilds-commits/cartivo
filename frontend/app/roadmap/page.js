import Nav from "../components/Nav";
import Footer from "../components/Footer";

export const metadata = {
  title: "Roadmap — Cartivo",
  description: "See what's next for the Cartivo platform.",
};

export default function RoadmapPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container" style={{ textAlign: "center", padding: "6rem 1rem" }}>
            <span className="eyebrow">Coming soon</span>
            <h2>Roadmap</h2>
            <p style={{ color: "var(--muted)", maxWidth: 480, margin: "1rem auto 0" }}>
              We&apos;re building in public. Our product roadmap will be shared here soon
              so you can see what&apos;s coming and vote on what matters most to your shop.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
