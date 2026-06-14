import Reveal from "../components/Reveal";

export const metadata = {
  title: "Roadmap — Cartivo",
  description: "See what's next for the Cartivo platform.",
  alternates: {
    canonical: "/roadmap",
  },
};

export default function RoadmapPage() {
  return (
    <>
      <main>
        <section className="features">
          <div className="container" style={{ textAlign: "center", padding: "6rem 1rem" }}>
            <Reveal>
              <span className="eyebrow">Coming soon</span>
              <h2>Roadmap</h2>
              <p style={{ color: "var(--muted)", maxWidth: 480, margin: "1rem auto 0" }}>
                We&apos;re building in public. Our product roadmap will be shared here soon
                so you can see what&apos;s coming and vote on what matters most to your shop.
              </p>
            </Reveal>
          </div>
        </section>
      </main>
    </>
  );
}
