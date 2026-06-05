import Icon from "./Icon";
import Reveal from "./Reveal";

const steps = [
  {
    n: 1,
    title: "Pick a theme",
    desc: "Choose a starting point and make it yours with inline editing — colors, fonts, layout.",
  },
  {
    n: 2,
    title: "Add your products",
    desc: "Import a CSV or add items by hand, with images, variants, and inventory tracking.",
  },
  {
    n: 3,
    title: "Go live",
    desc: "Connect a domain, switch on payments, and start taking orders the same day.",
  },
];

const facts = [
  { label: "Set up your store in", value: "an afternoon" },
  { label: "Starter themes", value: "12" },
  { label: "Payment methods", value: "100+" },
  { label: "Transaction fees", value: "0%" },
];

export default function HowItWorks() {
  return (
    <section id="how">
      <div className="container split">
        <Reveal className="split-copy">
          <span className="eyebrow">How it works</span>
          <h2 className="split-title">From zero to your first order, fast.</h2>
          <p className="split-lead">
            No developers or agencies required. Cartivo gets you live quickly,
            then stays out of your way.
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
