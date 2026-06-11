import Link from "next/link";
import Icon from "./Icon";
import Reveal from "./Reveal";

export default function Hero() {
  return (
    <header className="hero" id="top">
      <div className="container hero-grid">
        <div className="hero-copy">
          <Reveal as="span" className="eyebrow">
            Premium tech, fair prices
          </Reveal>
          <Reveal as="h1" delay={60}>
            Shop the latest <span className="accent">tech</span>, delivered fast.
          </Reveal>
          <Reveal as="p" className="lead" delay={120}>
            Laptops, smartphones, audio, wearables and more — browse a curated
            catalog with secure checkout, guest ordering, and shipping costs
            shown upfront.
          </Reveal>
          <Reveal className="hero-actions" delay={180}>
            <Link href="/products" className="btn btn-primary">
              Shop now
              <Icon name="arrowRight" size={18} />
            </Link>
            <a href="#categories" className="btn btn-ghost">
              Browse categories
            </a>
          </Reveal>
          <Reveal className="hero-trust" delay={240}>
            <Icon name="check" size={16} />
            Secure Stripe checkout
            <span className="dot-sep" aria-hidden="true">
              ·
            </span>
            No account required
          </Reveal>
        </div>

        <Reveal className="hero-visual" delay={160}>
          <div className="product-card">
            <div className="pc-top">
              <span>Your cart</span>
              <span className="pc-pill">3 items</span>
            </div>
            <div className="cart-lines">
              <div className="cart-line">
                <span>Apple AirPods Pro 3</span>
                <b>$249.00</b>
              </div>
              <div className="cart-line">
                <span>Apple Watch Series 10</span>
                <b>$399.00</b>
              </div>
              <div className="cart-line">
                <span>Logitech MX Master 3S</span>
                <b>$99.00</b>
              </div>
            </div>
            <div className="cart-total-row">
              <span>Subtotal</span>
              <span className="pc-revenue">$747.00</span>
            </div>
            <div className="pc-sub">
              <Icon name="truck" size={16} /> Free shipping over $500
            </div>
          </div>

          <div className="float-card fc-1">
            <div className="ic">
              <Icon name="creditCard" size={20} />
            </div>
            <div>
              <small>Checkout</small>
              <strong>Secure &amp; fast</strong>
            </div>
          </div>
          <div className="float-card fc-2">
            <div className="ic">
              <Icon name="package" size={20} />
            </div>
            <div>
              <small>Order #1042</small>
              <strong>Out for delivery</strong>
            </div>
          </div>
        </Reveal>
      </div>
    </header>
  );
}
