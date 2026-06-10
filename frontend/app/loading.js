import Nav from "./components/Nav";
import Footer from "./components/Footer";
import { Skeleton } from "./components/Skeleton";

export default function RootLoading() {
  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container" style={{ padding: "4rem 1rem" }}>
            <div className="section-head center">
              <Skeleton width="100px" height="0.85rem" style={{ margin: "0 auto 0.75rem" }} />
              <Skeleton width="260px" height="1.5rem" style={{ margin: "0 auto 0.5rem" }} />
              <Skeleton width="200px" height="0.9rem" style={{ margin: "0 auto" }} />
            </div>
            <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
              <Skeleton height="1rem" />
              <Skeleton height="1rem" width="90%" />
              <Skeleton height="1rem" width="75%" />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
