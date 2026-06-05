import Reveal from "./Reveal";

export default function WhyCartivo() {
  return (
    <section className="why" id="why">
      <div className="container why-inner">
        <Reveal className="why-copy">
          <span className="eyebrow">Why we built it</span>
          <h2>We got tired of duct-taping tools together.</h2>
          <p>
            Cartivo started because running a small shop meant juggling a site
            builder, a payments plugin, a spreadsheet, and three inboxes. We
            wanted one place that handles the basics well and respects your
            time.
          </p>
          <p>
            We&apos;re a small team shipping in the open. If you join early,
            you&apos;ll talk to the people building it — and help shape what
            comes next.
          </p>
          <a href="#pricing" className="why-link">
            Join the early access list →
          </a>
        </Reveal>
        <Reveal className="why-card" delay={120}>
          <div className="why-quote">
            &ldquo;Our goal is simple: you should be able to open your store,
            see what needs attention, and close the laptop by lunch.&rdquo;
          </div>
          <div className="why-author">
            <span className="why-avatar" aria-hidden="true">
              CK
            </span>
            <div>
              <b>Cartivo team</b>
              <span>Building in early access</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
