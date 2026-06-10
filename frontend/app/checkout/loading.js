import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { Skeleton } from "../components/Skeleton";

export default function CheckoutLoading() {
  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container">
            <div className="section-head center">
              <h2>Checkout</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", maxWidth: 800, margin: "0 auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <Skeleton width="120px" height="1rem" />
                <Skeleton height="2.5rem" radius="8px" />
                <Skeleton height="2.5rem" radius="8px" />
                <Skeleton height="2.5rem" radius="8px" />
                <Skeleton height="2.5rem" radius="8px" />
                <Skeleton width="140px" height="2.5rem" radius="999px" style={{ marginTop: "0.5rem" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Skeleton width="100px" height="1rem" />
                <Skeleton height="0.9rem" />
                <Skeleton height="0.9rem" />
                <Skeleton height="0.9rem" width="60%" />
                <div style={{ borderTop: "1px solid var(--line, #eee)", marginTop: "0.75rem", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between" }}>
                  <Skeleton width="40px" height="1rem" />
                  <Skeleton width="70px" height="1rem" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
