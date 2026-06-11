import Icon from "./Icon";
import Reveal from "./Reveal";

const features = [
  {
    icon: "creditCard",
    title: "Secure Stripe checkout",
    desc: "Pay safely with Stripe. Your card details never touch our servers — every payment is encrypted and PCI-compliant.",
  },
  {
    icon: "userCheck",
    title: "Guest checkout",
    desc: "No account needed. Add items to your cart and check out in seconds — or sign in to save your details for next time.",
  },
  {
    icon: "truck",
    title: "Shipping costs upfront",
    desc: "See shipping and tax estimated on your cart before you pay. No surprises at the final step.",
  },
  {
    icon: "mail",
    title: "Instant order updates",
    desc: "Get an order confirmation by email the moment you check out, plus a receipt once your payment clears.",
  },
  {
    icon: "heart",
    title: "Wishlist your favourites",
    desc: "Save the products you love to your wishlist and come back to them whenever you're ready to buy.",
  },
  {
    icon: "star",
    title: "Real customer reviews",
    desc: "Read honest ratings and reviews from other shoppers, so you can buy with confidence.",
  },
];

export default function Features() {
  return (
    <section className="features" id="features">
      <div className="container">
        <Reveal className="section-head center">
          <span className="eyebrow">Why shop with us</span>
          <h2>A checkout you can trust.</h2>
          <p>
            Everything about buying from Cartivo is built to be fast, clear, and
            secure — from your first click to your doorstep.
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
