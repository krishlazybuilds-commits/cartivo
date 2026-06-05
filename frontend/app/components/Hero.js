import Icon from "./Icon";
import Reveal from "./Reveal";

export default function Hero() {
  return (
    <header className="hero" id="top">
      <div className="container hero-grid">
        <div className="hero-copy">
          <Reveal as="span" className="eyebrow">
            Now in early access
          </Reveal>
          <Reveal as="h1" delay={60}>
            Sell online without the <span className="accent">busywork</span>.
          </Reveal>
          <Reveal as="p" className="lead" delay={120}>
            Cartivo gives independent brands a fast storefront, one inbox for
            every order, and clear numbers to act on — without stitching ten
            tools together.
          </Reveal>
          <Reveal className="hero-actions" delay={180}>
            <a href="#pricing" className="btn btn-primary">
              Get early access
              <Icon name="arrowRight" size={18} />
            </a>
            <a href="#how" className="btn btn-ghost">
              <Icon name="play" size={16} />
              See how it works
            </a>
          </Reveal>
          <Reveal className="hero-trust" delay={240}>
            <Icon name="check" size={16} />
            Free 14-day trial
            <span className="dot-sep" aria-hidden="true">
              ·
            </span>
            No credit card required
          </Reveal>
        </div>

        <Reveal className="hero-visual" delay={160}>
          <div className="product-card">
            <div className="pc-top">
              <span>Today&apos;s orders</span>
              <span className="pc-pill">Live</span>
            </div>
            <div className="pc-revenue">$1,284</div>
            <div className="pc-sub">
              <Icon name="trend" size={16} /> 9 orders so far today
            </div>
            <div className="bars">
              <i style={{ height: "38%" }} />
              <i style={{ height: "55%" }} />
              <i style={{ height: "30%" }} />
              <i style={{ height: "72%" }} />
              <i style={{ height: "48%" }} />
              <i className="hot" style={{ height: "90%" }} />
              <i style={{ height: "64%" }} />
            </div>
            <div className="bar-labels">
              <span>9a</span>
              <span>11a</span>
              <span>1p</span>
              <span>3p</span>
              <span>5p</span>
              <span>7p</span>
              <span>9p</span>
            </div>
          </div>

          <div className="float-card fc-1">
            <div className="ic">
              <Icon name="cart" size={20} />
            </div>
            <div>
              <small>New order · #1042</small>
              <strong>$129.00</strong>
            </div>
          </div>
          <div className="float-card fc-2">
            <div className="ic">
              <Icon name="zap" size={20} />
            </div>
            <div>
              <small>Checkout</small>
              <strong>1-tap pay</strong>
            </div>
          </div>
        </Reveal>
      </div>
    </header>
  );
}
