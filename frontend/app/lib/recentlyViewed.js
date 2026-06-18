const STORAGE_KEY = "cartivo_recently_viewed";
const MAX_ITEMS = 10;

export function getRecentlyViewed() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addRecentlyViewed(product) {
  if (typeof window === "undefined") return;
  const items = getRecentlyViewed().filter((p) => p.id !== product.id);
  items.unshift({ id: product.id, slug: product.slug });
  if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage full or unavailable
  }
}

export function clearRecentlyViewed() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // unavailable
  }
}
