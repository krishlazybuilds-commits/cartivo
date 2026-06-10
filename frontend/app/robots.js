const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Don't index account/transactional pages.
      disallow: ["/cart", "/checkout", "/orders", "/profile"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
