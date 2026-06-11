"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";

import SortSelect from "./SortSelect";

const SORT_OPTIONS = [
  { value: "", label: "Default" },
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "price", label: "Price: low → high" },
  { value: "-price", label: "Price: high → low" },
  { value: "name", label: "Name: A → Z" },
  { value: "-name", label: "Name: Z → A" },
];

export default function ShopFilters({ categories, activeCategory, activeSearch, activeSort }) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(activeSearch || "");

  function buildQuery(overrides) {
    const next = new URLSearchParams(params.toString());
    Object.entries(overrides).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    const qs = next.toString();
    return qs ? `/products?${qs}` : "/products";
  }

  function selectCategory(id) {
    router.push(buildQuery({ category: id || "", page: "" }));
  }

  function changeSort(value) {
    router.push(buildQuery({ ordering: value || "", page: "" }));
  }

  // Auto-search with debounce
  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = search.trim();
      if (trimmed !== (activeSearch || "")) {
        router.push(buildQuery({ search: trimmed || "", page: "" }));
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="shop-filters">
      <div className="shop-search">
        <input
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
        />
      </div>

      <div className="shop-filters-row">
        <div className="shop-cats">
          <button
            type="button"
            className={`shop-cat${!activeCategory ? " active" : ""}`}
            onClick={() => selectCategory("")}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`shop-cat${String(activeCategory) === String(c.id) ? " active" : ""}`}
              onClick={() => selectCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="shop-sort">
          <SortSelect value={activeSort || ""} options={SORT_OPTIONS} onChange={changeSort} />
        </div>
      </div>
    </div>
  );
}
