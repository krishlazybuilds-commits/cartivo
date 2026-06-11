import Footer from "../../components/Footer";
import { Skeleton } from "../../components/Skeleton";

export default function ProductDetailLoading() {
  return (
    <>
      <main>
        <section className="features">
          <div className="container">
            <div className="product-detail">
              <Skeleton width="100%" height="320px" radius="12px" />
              <div>
                <Skeleton width="80px" height="0.75rem" style={{ marginBottom: "0.75rem" }} />
                <Skeleton width="240px" height="1.75rem" style={{ marginBottom: "1rem" }} />
                <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
                  <Skeleton width="70px" height="1.25rem" />
                  <Skeleton width="60px" height="1rem" />
                </div>
                <Skeleton width="100%" height="0.85rem" style={{ marginBottom: "0.5rem" }} />
                <Skeleton width="90%" height="0.85rem" style={{ marginBottom: "0.5rem" }} />
                <Skeleton width="70%" height="0.85rem" style={{ marginBottom: "2rem" }} />
                <Skeleton width="140px" height="2.5rem" radius="999px" />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
