import Footer from "../components/Footer";
import { OrdersListSkeleton } from "../components/Skeleton";

export default function OrdersLoading() {
  return (
    <>
      <main>
        <section className="features">
          <div className="container">
            <div className="section-head center">
              <h2>Your orders</h2>
            </div>
            <OrdersListSkeleton />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
