import Hero from "./components/Hero";
import FeaturedProducts from "./components/FeaturedProducts";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import WhyCartivo from "./components/WhyCartivo";
import Pricing from "./components/Pricing";
import CTA from "./components/CTA";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <FeaturedProducts />
        <Features />
        <HowItWorks />
        <WhyCartivo />
        <Pricing />
        <CTA />
      </main>
    </>
  );
}
