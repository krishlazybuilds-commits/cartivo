import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import { OrderDetailSkeleton } from "../../components/Skeleton";

export default function OrderDetailLoading() {
  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container">
            <div className="section-head center">
              <h2>Order details</h2>
            </div>
            <OrderDetailSkeleton />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
