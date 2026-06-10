import { apiFetch } from "./lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Static, publicly indexable routes.
const STATIC_PATHS = [
  "",
  "/products",
  "/categories",
  "/about",
  "/contact",
  "/blog",
  "/themes",
  "/roadmap",
  "/privacy",
  "/terms",
  "/security",
];

export default async function sitemap() {
  const now = new Date();

  const staticEntries = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  let dynamicEntries = [];
  try {
    const [products, categories] = await Promise.all([
      apiFetch("/products/"),
      apiFetch("/categories/"),
    ]);
    const productList = products.results ?? products;
    const categoryList = categories.results ?? categories;

    dynamicEntries = [
      ...productList.map((p) => ({
        url: `${SITE_URL}/products/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : now,
        changeFrequency: "weekly",
        priority: 0.6,
      })),
      ...categoryList.map((c) => ({
        url: `${SITE_URL}/categories/${c.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      })),
    ];
  } catch {
    // If the API is unreachable at build/request time, still return static routes.
  }

  return [...staticEntries, ...dynamicEntries];
}
