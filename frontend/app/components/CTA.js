import Link from "next/link";

import Icon from "./Icon";
import Reveal from "./Reveal";

export default function CTA() {
  return (
    <section className="cta-band">
      <div className="container">
        <Reveal className="cta-inner">
          <h2>Be one of the first stores on Cartivo.</h2>
          <p>
            Early access is open. Set up your store this week and tell us what to
            build next.
          </p>
          <div className="hero-actions">
            <Link href="/register" className="btn btn-primary">
              Get early access
              <Icon name="arrowRight" size={18} />
            </Link>
            <Link href="/contact" className="btn btn-light">
              Talk to the team
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
