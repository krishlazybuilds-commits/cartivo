const columns = [
  {
    title: "Product",
    links: ["Features", "Pricing", "Themes", "Roadmap"],
  },
  {
    title: "Company",
    links: ["About", "Blog", "Contact"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms", "Security"],
  },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <a href="#top" className="brand">
              <span className="brand-dot">C</span>
              Cartivo
            </a>
            <p className="tag">
              A simpler way for independent brands to sell online. Currently in
              early access.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© 2026 Cartivo. All rights reserved.</span>
          <span>Made for small shops.</span>
        </div>
      </div>
    </footer>
  );
}
