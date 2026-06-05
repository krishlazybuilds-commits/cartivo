export default function Home() {
  return (
    <>
      {/* ---------------- Nav ---------------- */}
      <nav className="nav">
        <div className="container nav-inner">
          <a href="#" className="brand">
            <span className="brand-dot">C</span>
            Cartivo
          </a>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#testimonial">Customers</a>
          </div>
          <div className="nav-cta">
            <a href="#" className="btn btn-ghost">
              Sign in
            </a>
            <a href="#pricing" className="btn btn-primary">
              Start free
            </a>
          </div>
        </div>
      </nav>

      {/* ---------------- Hero ---------------- */}
      <header className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">The modern commerce platform</span>
            <h1>
              Commerce, <span className="accent">beautifully</span> simple.
            </h1>
            <p className="lead">
              Launch a storefront your customers love, sell across every
              channel, and grow revenue — all from one elegant dashboard.
            </p>
            <div className="hero-actions">
              <a href="#pricing" className="btn btn-primary">
                Start free trial →
              </a>
              <a href="#how" className="btn btn-ghost">
                ▶ Watch demo
              </a>
            </div>
            <div className="hero-trust">
              <div className="avatars">
                <span>A</span>
                <span>M</span>
                <span>K</span>
                <span>+</span>
              </div>
              <div>
                <div className="stars">★★★★★</div>
                Loved by 12,000+ growing brands
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="product-card">
              <div className="pc-top">
                <span>Revenue · This month</span>
                <span className="pc-pill">Live</span>
              </div>
              <div className="pc-revenue">$248,910</div>
              <div className="pc-sub">
                <b>▲ 18.4%</b> vs last month
              </div>
              <div className="bars">
                <i style={{ height: "45%" }} />
                <i style={{ height: "62%" }} />
                <i style={{ height: "38%" }} />
                <i style={{ height: "78%" }} />
                <i style={{ height: "56%" }} />
                <i className="hot" style={{ height: "95%" }} />
                <i style={{ height: "70%" }} />
              </div>
              <div className="bar-labels">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>

            <div className="float-card fc-1">
              <div className="ic">🛒</div>
              <div>
                <small>New order</small>
                <strong>+$129.00</strong>
              </div>
            </div>
            <div className="float-card fc-2">
              <div className="ic">⚡</div>
              <div>
                <small>Conversion</small>
                <strong>4.8%</strong>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ---------------- Logos ---------------- */}
      <div className="logos">
        <div className="container logos-inner">
          <span>Northwind</span>
          <span>Lumière</span>
          <span>Atlas&nbsp;Co</span>
          <span>Verde</span>
          <span>Maison</span>
          <span>Orbit</span>
        </div>
      </div>

      {/* ---------------- Features ---------------- */}
      <section className="features" id="features">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow">Why Cartivo</span>
            <h2>Everything you need to sell, nothing you don&apos;t.</h2>
            <p>
              A thoughtfully designed toolkit that scales from your first sale
              to your millionth — without the bloat.
            </p>
          </div>
          <div className="feature-grid">
            {[
              {
                icon: "🎨",
                title: "Designer storefronts",
                desc: "Pixel-perfect, fully responsive themes that look premium on every device — no code required.",
              },
              {
                icon: "⚙️",
                title: "Powerful automation",
                desc: "Automate inventory, fulfilment, and follow-ups so you can focus on the work that matters.",
              },
              {
                icon: "📊",
                title: "Real-time analytics",
                desc: "Understand your customers with live dashboards and insights that are actually actionable.",
              },
              {
                icon: "🌍",
                title: "Sell everywhere",
                desc: "One catalog, every channel — web, social, marketplaces, and in-person, perfectly in sync.",
              },
              {
                icon: "🔒",
                title: "Secure by default",
                desc: "PCI-compliant checkout, fraud protection, and bank-grade encryption built right in.",
              },
              {
                icon: "💬",
                title: "Human support",
                desc: "Real people, ready 24/7. Average first response time under four minutes.",
              },
            ].map((f) => (
              <div className="feature-card" key={f.title}>
                <div className="ficon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- How it works / split ---------------- */}
      <section id="how">
        <div className="container split">
          <div>
            <span className="eyebrow">How it works</span>
            <h2 style={{ fontSize: "2.6rem", margin: "16px 0 18px" }}>
              From idea to first sale in an afternoon.
            </h2>
            <p style={{ color: "var(--slate)", fontSize: "1.1rem" }}>
              No developers, no agencies, no waiting. Cartivo gets you live
              fast, then grows with you.
            </p>
            <ul className="checklist">
              <li>
                <span className="tick">1</span>
                <div>
                  <b>Pick a theme</b>
                  <span>
                    Choose from designer-crafted templates and make it yours in
                    minutes.
                  </span>
                </div>
              </li>
              <li>
                <span className="tick">2</span>
                <div>
                  <b>Add your products</b>
                  <span>
                    Import in bulk or add by hand — rich media and variants
                    supported.
                  </span>
                </div>
              </li>
              <li>
                <span className="tick">3</span>
                <div>
                  <b>Go live &amp; grow</b>
                  <span>
                    Launch with built-in SEO, payments, and marketing tools
                    ready to go.
                  </span>
                </div>
              </li>
            </ul>
          </div>
          <div className="split-visual">
            <div className="vrow">
              <span>Setup time</span>
              <b>~ 2 hours</b>
            </div>
            <div className="vrow">
              <span>Themes available</span>
              <b>80+</b>
            </div>
            <div className="vrow">
              <span>Payment methods</span>
              <b>100+</b>
            </div>
            <div className="vrow">
              <span>Avg. uptime</span>
              <b>99.99%</b>
            </div>
            <div className="vrow">
              <span>Transaction fees</span>
              <b>From 0%</b>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Stats ---------------- */}
      <section className="stats">
        <div className="container">
          <div className="stat-grid">
            <div>
              <div className="num">12k+</div>
              <p>Active brands</p>
            </div>
            <div>
              <div className="num">$3.4B</div>
              <p>Processed in sales</p>
            </div>
            <div>
              <div className="num">175</div>
              <p>Countries served</p>
            </div>
            <div>
              <div className="num">4.9/5</div>
              <p>Average rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Testimonial ---------------- */}
      <section id="testimonial">
        <div className="container quote">
          <div className="stars">★★★★★</div>
          <blockquote>
            “We switched to Cartivo and rebuilt our store in a weekend. Sales
            are up 40% and the dashboard is the first thing I open every
            morning.”
          </blockquote>
          <div className="who">
            Maya Okonkwo
            <span>Founder, Verde Studio</span>
          </div>
        </div>
      </section>

      {/* ---------------- Pricing ---------------- */}
      <section className="pricing" id="pricing">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow">Pricing</span>
            <h2>Simple plans that grow with you.</h2>
            <p>Start free for 14 days. No credit card required.</p>
          </div>
          <div className="price-grid">
            <div className="price-card">
              <span className="tier">Starter</span>
              <div className="price">
                $19<small>/mo</small>
              </div>
              <ul>
                <li>Up to 100 products</li>
                <li>2 staff accounts</li>
                <li>Standard themes</li>
                <li>Email support</li>
              </ul>
              <a href="#" className="btn btn-ghost">
                Choose Starter
              </a>
            </div>
            <div className="price-card featured">
              <span className="tier">Growth · Popular</span>
              <div className="price">
                $49<small>/mo</small>
              </div>
              <ul>
                <li>Unlimited products</li>
                <li>10 staff accounts</li>
                <li>All premium themes</li>
                <li>Advanced analytics</li>
                <li>Priority 24/7 support</li>
              </ul>
              <a href="#" className="btn btn-primary">
                Start free trial
              </a>
            </div>
            <div className="price-card">
              <span className="tier">Scale</span>
              <div className="price">
                $129<small>/mo</small>
              </div>
              <ul>
                <li>Everything in Growth</li>
                <li>Unlimited staff</li>
                <li>Custom checkout</li>
                <li>Dedicated manager</li>
              </ul>
              <a href="#" className="btn btn-ghost">
                Choose Scale
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="cta-band">
        <div className="container">
          <div className="cta-inner">
            <h2>Ready to build something beautiful?</h2>
            <p>
              Join thousands of brands selling smarter with Cartivo. Your
              storefront is just an afternoon away.
            </p>
            <div className="hero-actions">
              <a href="#" className="btn btn-primary">
                Start your free trial →
              </a>
              <a href="#" className="btn btn-light">
                Talk to sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <a href="#" className="brand">
                <span className="brand-dot">C</span>
                Cartivo
              </a>
              <p className="tag">
                The modern commerce platform for brands that care about design.
              </p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li>
                  <a href="#features">Features</a>
                </li>
                <li>
                  <a href="#pricing">Pricing</a>
                </li>
                <li>
                  <a href="#">Themes</a>
                </li>
                <li>
                  <a href="#">Integrations</a>
                </li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li>
                  <a href="#">About</a>
                </li>
                <li>
                  <a href="#">Careers</a>
                </li>
                <li>
                  <a href="#">Blog</a>
                </li>
                <li>
                  <a href="#">Contact</a>
                </li>
              </ul>
            </div>
            <div>
              <h4>Legal</h4>
              <ul>
                <li>
                  <a href="#">Privacy</a>
                </li>
                <li>
                  <a href="#">Terms</a>
                </li>
                <li>
                  <a href="#">Security</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 Cartivo, Inc. All rights reserved.</span>
            <span>Made with care · No purple, promise 🧡</span>
          </div>
        </div>
      </footer>
    </>
  );
}
