export default function Nav() {
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <a href="#top" className="brand" aria-label="Cartivo home">
          <span className="brand-dot">C</span>
          Cartivo
        </a>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#why">Why Cartivo</a>
          <a href="/products">Shop</a>
        </div>
        <div className="nav-cta">
          <a href="#" className="btn btn-ghost">
            Sign in
          </a>
          <a href="#pricing" className="btn btn-primary">
            Get early access
          </a>
        </div>
      </div>
    </nav>
  );
}
