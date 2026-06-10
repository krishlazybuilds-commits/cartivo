import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { CartSkeleton } from "../components/Skeleton";

export default function CartLoading() {
  return (
    <>
      <Nav />
      <main>
        <section className="features">
          <div className="container">
            <div className="section-head center">
              <h2>Your cart</h2>
            </div>
            <CartSkeleton />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
