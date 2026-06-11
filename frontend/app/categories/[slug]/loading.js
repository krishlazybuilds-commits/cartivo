import Footer from "../../components/Footer";
import { Skeleton } from "../../components/Skeleton";

export default function CategoryLoading() {
  return (
    <>
      <main>
        <section className="features">
          <div className="container">
            <div className="section-head center">
              <Skeleton width="60px" height="0.75rem" style={{ margin: "0 auto 0.75rem" }} />
              <Skeleton width="220px" height="1.5rem" style={{ margin: "0 auto 0.5rem" }} />
              <Skeleton width="260px" height="0.9rem" style={{ margin: "0 auto" }} />
            </div>
            <div className="feature-grid" style={{ marginTop: "2rem" }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div className="feature-card product-card" key={i}>
                  <Skeleton width="100%" height="140px" radius="10px" />
                  <Skeleton width="60px" height="0.7rem" style={{ marginTop: "1rem" }} />
                  <Skeleton width="140px" height="1rem" style={{ marginTop: "0.5rem" }} />
                  <Skeleton width="100%" height="0.8rem" style={{ marginTop: "0.4rem" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem" }}>
                    <Skeleton width="60px" height="1rem" />
                    <Skeleton width="50px" height="0.8rem" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
