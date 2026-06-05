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
            <a href="#" className="btn btn-primary">
              Get early access
              <Icon name="arrowRight" size={18} />
            </a>
            <a href="#" className="btn btn-light">
              Talk to the team
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
