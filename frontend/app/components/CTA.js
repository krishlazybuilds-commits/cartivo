import Link from "next/link";

import Icon from "./Icon";
import Reveal from "./Reveal";

export default function CTA() {
  return (
    <section className="cta-band">
      <div className="container">
        <Reveal className="cta-inner">
          <h2>Ready to find your next upgrade?</h2>
          <p>
            Browse the full catalog of laptops, audio, phones, wearables and
            more — with secure checkout and shipping costs shown upfront.
          </p>
          <div className="hero-actions">
            <Link href="/products" className="btn btn-primary">
              Shop all products
              <Icon name="arrowRight" size={18} />
            </Link>
            <Link href="/contact" className="btn btn-light">
              Contact us
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
