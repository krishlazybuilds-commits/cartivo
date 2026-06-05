import Icon from "./Icon";
import Reveal from "./Reveal";

const features = [
  {
    icon: "palette",
    title: "A storefront in minutes",
    desc: "Start from a clean, responsive theme and edit it inline. No code, no designer hand-off, no waiting.",
  },
  {
    icon: "zap",
    title: "One inbox for orders",
    desc: "Orders, refunds, and customer messages land in one place — so nothing slips while you're busy shipping.",
  },
  {
    icon: "chart",
    title: "Numbers you can act on",
    desc: "See what's selling and what's stalling in plain language, not a spreadsheet you have to decode.",
  },
  {
    icon: "globe",
    title: "Sell beyond your site",
    desc: "Keep one product catalog in sync across your store, social, and in-person — edit once, update everywhere.",
  },
  {
    icon: "shield",
    title: "Checkout that's safe",
    desc: "PCI-compliant payments and fraud checks are built in, so you don't have to wire them up yourself.",
  },
  {
    icon: "message",
    title: "Support from real people",
    desc: "Email and chat with a human when you're stuck. We're a small team and we answer our own tickets.",
  },
];

export default function Features() {
  return (
    <section className="features" id="features">
      <div className="container">
        <Reveal className="section-head center">
          <span className="eyebrow">What you get</span>
          <h2>The essentials, done well.</h2>
          <p>
            Cartivo focuses on the handful of things that actually move a small
            store forward — and leaves out the rest.
          </p>
        </Reveal>
        <div className="feature-grid">
          {features.map((f, i) => (
            <Reveal className="feature-card" key={f.title} delay={i * 60}>
              <div className="ficon">
                <Icon name={f.icon} size={24} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
