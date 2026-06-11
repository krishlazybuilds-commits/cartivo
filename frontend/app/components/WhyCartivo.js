import Reveal from "./Reveal";

export default function WhyCartivo() {
  return (
    <section className="why" id="why">
      <div className="container why-inner">
        <Reveal className="why-copy">
          <span className="eyebrow">Our promise</span>
          <h2>Tech shopping without the worry.</h2>
          <p>
            Every product in our catalog is the real deal, priced fairly, and
            backed by secure Stripe payments. You&apos;ll always see shipping and
            tax before you pay — no hidden fees, no surprises at checkout.
          </p>
          <p>
            Prefer not to make an account? Check out as a guest. Want to track
            orders and save favourites? Sign in and everything&apos;s in one
            place. Either way, your data stays protected.
          </p>
          <a href="#categories" className="why-link">
            Start browsing the catalog →
          </a>
        </Reveal>
        <Reveal className="why-card" delay={120}>
          <div className="why-quote">
            &ldquo;Fast checkout, clear shipping costs, and my order confirmation
            hit my inbox instantly. Exactly how online shopping should
            feel.&rdquo;
          </div>
          <div className="why-author">
            <span className="why-avatar" aria-hidden="true">
              ★
            </span>
            <div>
              <b>Verified shopper</b>
              <span>Rated 5 / 5</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
