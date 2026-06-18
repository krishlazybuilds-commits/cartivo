"use client";

import { useEffect } from "react";
import { addRecentlyViewed } from "../lib/recentlyViewed";

export default function RecentlyViewedTracker({ product }) {
  useEffect(() => {
    if (product?.id) {
      addRecentlyViewed({ id: product.id, slug: product.slug });
    }
  }, [product?.id, product?.slug]);

  return null;
}
