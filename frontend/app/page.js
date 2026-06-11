import Hero from "./components/Hero";
import Categories from "./components/Categories";
import FeaturedProducts from "./components/FeaturedProducts";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import WhyCartivo from "./components/WhyCartivo";
import CTA from "./components/CTA";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <Categories />
        <FeaturedProducts />
        <Features />
        <HowItWorks />
        <WhyCartivo />
        <CTA />
      </main>
    </>
  );
}
