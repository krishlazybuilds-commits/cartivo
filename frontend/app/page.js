import Nav from "./components/Nav";
import Hero from "./components/Hero";
import FeaturedProducts from "./components/FeaturedProducts";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import WhyCartivo from "./components/WhyCartivo";
import Pricing from "./components/Pricing";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <>
      <a href="#features" className="skip-link">
        Skip to content
      </a>
      <Nav />
      <main>
        <Hero />
        <FeaturedProducts />
        <Features />
        <HowItWorks />
        <WhyCartivo />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
