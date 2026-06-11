import Icon from "./Icon";
import Reveal from "./Reveal";

const steps = [
  {
    n: 1,
    title: "Browse the catalog",
    desc: "Explore laptops, audio, phones, wearables and more. Filter by category, sort by price, and read real reviews.",
  },
  {
    n: 2,
    title: "Add to cart",
    desc: "Add items to your cart and see shipping and tax estimated before you commit — no hidden costs.",
  },
  {
    n: 3,
    title: "Check out securely",
    desc: "Pay with Stripe as a guest or signed-in customer. Your details are encrypted end to end.",
  },
  {
    n: 4,
    title: "Track your order",
    desc: "Get instant email confirmation and follow your order status right through to delivery.",
  },
];

const facts = [
  { label: "Product categories", value: "6" },
  { label: "Free shipping over", value: "$500" },
  { label: "Guest checkout", value: "Yes" },
  { label: "Secure payments", value: "Stripe" },
];

export default function HowItWorks() {
  return (
    <section id="how">
      <div className="container split">
        <Reveal className="split-copy">
          <span className="eyebrow">How it works</span>
          <h2 className="split-title">From browsing to your doorstep.</h2>
          <p className="split-lead">
            Shopping with Cartivo is simple and secure — here&apos;s what to
            expect from cart to delivery.
          </p>
          <ul className="checklist">
            {steps.map((s) => (
              <li key={s.n}>
                <span className="tick">
                  <Icon name="check" size={15} />
                </span>
                <div>
                  <b>{s.title}</b>
                  <span>{s.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal className="split-visual" delay={120}>
          {facts.map((f) => (
            <div className="vrow" key={f.label}>
              <span>{f.label}</span>
              <b>{f.value}</b>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
