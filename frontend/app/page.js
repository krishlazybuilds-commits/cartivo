import Hero from "./components/Hero";
import Categories from "./components/Categories";
import FeaturedProducts from "./components/FeaturedProducts";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import WhyCartivo from "./components/WhyCartivo";
import CTA from "./components/CTA";
import RecentlyViewed from "./components/RecentlyViewed";
import JsonLd from "./components/JsonLd";

export default function Home() {
  const siteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Cartivo",
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/products?search={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <>
      <JsonLd data={siteJsonLd} />
      <main>
        <Hero />
        <Categories />
        <FeaturedProducts />
        <RecentlyViewed />
        <Features />
        <HowItWorks />
        <WhyCartivo />
        <CTA />
      </main>
    </>
  );
}
