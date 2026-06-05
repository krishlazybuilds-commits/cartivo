import Icon from "./Icon";
import Reveal from "./Reveal";

const plans = [
  {
    tier: "Starter",
    price: "$19",
    period: "/mo",
    features: ["Up to 100 products", "2 staff accounts", "Standard themes", "Email support"],
    cta: "Start free trial",
    style: "btn-ghost",
  },
  {
    tier: "Growth",
    badge: "Most flexible",
    price: "$49",
    period: "/mo",
    features: [
      "Unlimited products",
      "10 staff accounts",
      "All themes",
      "Order & sales insights",
      "Priority support",
    ],
    cta: "Get early access",
    style: "btn-primary",
    featured: true,
  },
  {
    tier: "Scale",
    price: "$129",
    period: "/mo",
    features: ["Everything in Growth", "Unlimited staff", "Custom checkout", "Onboarding help"],
    cta: "Start free trial",
    style: "btn-ghost",
  },
];

export default function Pricing() {
  return (
    <section className="pricing" id="pricing">
      <div className="container">
        <Reveal className="section-head center">
          <span className="eyebrow">Pricing</span>
          <h2>Honest pricing, free to try.</h2>
          <p>Start free for 14 days. No credit card, cancel anytime.</p>
        </Reveal>
        <div className="price-grid">
          {plans.map((p, i) => (
            <Reveal
              className={`price-card${p.featured ? " featured" : ""}`}
              key={p.tier}
              delay={i * 80}
            >
              <span className="tier">{p.badge ? `${p.tier} · ${p.badge}` : p.tier}</span>
              <div className="price">
                {p.price}
                <small>{p.period}</small>
              </div>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <Icon name="check" size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#" className={`btn ${p.style}`}>
                {p.cta}
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
