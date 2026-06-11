export function Skeleton({ width = "100%", height = "1rem", radius = "6px", style = {} }) {
  return (
    <span
      className="skeleton"
      style={{ width, height, borderRadius: radius, display: "block", ...style }}
      aria-hidden="true"
    />
  );
}

export function CartSkeleton() {
  return (
    <div className="cart">
      <ul className="cart-items">
        {[1, 2, 3].map((i) => (
          <li className="cart-item" key={i}>
            <div className="cart-item-info">
              <Skeleton width="160px" height="1rem" style={{ marginBottom: "6px" }} />
              <Skeleton width="80px" height="0.75rem" />
            </div>
            <Skeleton width="90px" height="2rem" radius="999px" />
            <Skeleton width="60px" height="1rem" />
            <Skeleton width="60px" height="1rem" />
          </li>
        ))}
      </ul>
      <div className="cart-summary">
        <div className="cart-total">
          <Skeleton width="60px" height="1rem" />
          <Skeleton width="80px" height="1.25rem" />
        </div>
      </div>
    </div>
  );
}

export function OrdersListSkeleton() {
  return (
    <div className="orders">
      {[1, 2].map((i) => (
        <div className="order-card" key={i}>
          <div className="order-head">
            <Skeleton width="140px" height="1rem" />
            <Skeleton width="70px" height="1.5rem" radius="999px" />
          </div>
          <ul className="order-items" style={{ marginTop: "1rem" }}>
            {[1, 2].map((j) => (
              <li key={j} style={{ display: "flex", justifyContent: "space-between" }}>
                <Skeleton width="180px" height="0.9rem" />
                <Skeleton width="60px" height="0.9rem" />
              </li>
            ))}
          </ul>
          <div className="cart-total" style={{ marginTop: "1rem" }}>
            <Skeleton width="40px" height="0.9rem" />
            <Skeleton width="70px" height="1rem" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="order-card" style={{ maxWidth: 640 }}>
      <div className="order-head">
        <Skeleton width="150px" height="1rem" />
        <Skeleton width="70px" height="1.5rem" radius="999px" />
      </div>
      <ul className="order-items" style={{ marginTop: "1rem" }}>
        {[1, 2, 3].map((i) => (
          <li key={i} style={{ display: "flex", justifyContent: "space-between" }}>
            <Skeleton width="200px" height="0.9rem" />
            <Skeleton width="60px" height="0.9rem" />
          </li>
        ))}
      </ul>
      <div className="cart-total" style={{ marginTop: "1rem" }}>
        <Skeleton width="40px" height="0.9rem" />
        <Skeleton width="70px" height="1rem" />
      </div>
      <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--line)", paddingTop: "1.5rem" }}>
        <Skeleton width="120px" height="1rem" style={{ marginBottom: "0.75rem" }} />
        <Skeleton width="180px" height="0.85rem" style={{ marginBottom: "6px" }} />
        <Skeleton width="220px" height="0.85rem" style={{ marginBottom: "6px" }} />
        <Skeleton width="160px" height="0.85rem" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }) {
  return (
    <div className="feature-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="feature-card product-card">
          <Skeleton width="100%" height="160px" radius="12px" style={{ marginBottom: "0.75rem" }} />
          <Skeleton width="60%" height="1rem" style={{ marginBottom: "0.5rem" }} />
          <Skeleton width="40%" height="0.9rem" />
        </div>
      ))}
    </div>
  );
}
