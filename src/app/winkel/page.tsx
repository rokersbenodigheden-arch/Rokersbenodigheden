"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X, Store, ExternalLink, Star } from "lucide-react";
import { SITE_PRODUCTS, PRODUCTS, shopProductUrl, type SiteProduct } from "@/lib/products";
import { cn, formatEuro } from "@/lib/utils";

// Build admin lookup once for richer info per live product
const ADMIN_BY_SKU = new Map(PRODUCTS.map((p) => [p.sku, p]));

const CATEGORY_OPTIONS: string[] = (() => {
  const set = new Set<string>();
  for (const p of SITE_PRODUCTS) if (p.category) set.add(p.category);
  return [...set].sort();
})();

type SortKey = "name" | "price" | "rating" | "reviews";
type SortDir = "asc" | "desc";

export default function WinkelPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let out: SiteProduct[] = SITE_PRODUCTS;
    if (category) out = out.filter((p) => p.category === category);
    if (q) {
      const tokens = q.split(/\s+/);
      out = out.filter((p) => {
        const hay = `${p.name} ${p.brand} ${p.category} ${p.sku}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }
    out = [...out].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":    return a.name.localeCompare(b.name) * dir;
        case "price":   return (parseFloat(a.price) - parseFloat(b.price)) * dir;
        case "rating":  return (a.rating - b.rating) * dir;
        case "reviews": return (a.reviewCount - b.reviewCount) * dir;
      }
    });
    return out;
  }, [query, category, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

      <div className="mb-6 sm:mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 mb-3">
          <Store className="size-3.5" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live op shop</span>
        </div>
        <h1 className="font-black text-3xl sm:text-4xl text-slate-900 tracking-tight mb-2">
          {SITE_PRODUCTS.length.toLocaleString("nl-NL")} producten actief op de webshop
        </h1>
        <p className="text-slate-500 text-sm max-w-2xl">
          Dit is wat je klanten op dit moment online kunnen kopen — gekoppeld aan de productzoeker via SKU.
          Klik door om de live productpagina te openen.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter op naam, merk, SKU…"
          className="w-full h-11 pl-11 pr-11 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 transition-all"
        />
        {query && (
          <button
            type="button"
            aria-label="Wissen"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 size-7 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 flex items-center justify-center"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={cn(
            "px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider transition-colors",
            !category ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
          )}
        >
          Alle ({SITE_PRODUCTS.length})
        </button>
        {CATEGORY_OPTIONS.map((c) => {
          const count = SITE_PRODUCTS.filter((p) => p.category === c).length;
          return (
            <button
              type="button"
              key={c}
              onClick={() => setCategory(category === c ? "" : c)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider transition-colors",
                category === c ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
              )}
            >
              {c} ({count})
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] text-slate-500">
          <span className="font-bold text-slate-900 tabular-nums">{filtered.length.toLocaleString("nl-NL")}</span> producten getoond
        </p>
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-slate-400 mr-1">Sorteer:</span>
          {(["name", "price", "rating", "reviews"] as SortKey[]).map((k) => {
            const labels = { name: "Naam", price: "Prijs", rating: "Score", reviews: "Reviews" };
            const active = sortKey === k;
            return (
              <button
                type="button"
                key={k}
                onClick={() => toggleSort(k)}
                className={cn(
                  "px-2.5 py-1 rounded-md border transition-colors font-bold uppercase tracking-wider",
                  active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:text-slate-900"
                )}
              >
                {labels[k]}{active && (sortDir === "asc" ? " ▲" : " ▼")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {filtered.map((p) => {
          const admin = ADMIN_BY_SKU.get(p.sku);
          const livePrice = parseFloat(p.price);
          const adminSell = admin?.sell ?? 0;
          const margin = admin?.margin ?? null;
          return (
            <Link
              key={p.id}
              href={shopProductUrl(p.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col bg-white border border-slate-100 hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-xl overflow-hidden"
            >
              <div className="relative aspect-square bg-slate-50 overflow-hidden">
                <Image
                  src={p.image}
                  alt={p.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 20vw"
                  className="object-contain p-3 sm:p-4 transition-transform duration-500 group-hover:scale-[1.04]"
                  style={{ mixBlendMode: "multiply" }}
                />
                <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                  <Store className="size-2.5" />
                  Live
                </span>
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[9px] font-bold text-slate-700 bg-white/90 backdrop-blur px-2 py-0.5 rounded-full border border-slate-200">
                  <ExternalLink className="size-2.5" />
                </span>
              </div>
              <div className="flex flex-col flex-1 p-3 gap-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 truncate">
                  {p.brand} · {p.category}
                </p>
                <p className="text-[12px] font-bold text-slate-900 leading-snug line-clamp-2">{p.name}</p>
                <p className="text-[10px] text-slate-400 tabular-nums">SKU {p.sku}</p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                  <span className="font-black text-[14px] text-slate-900 tabular-nums">
                    {formatEuro(livePrice)}
                  </span>
                  {margin != null && (
                    <span className={cn(
                      "text-[10px] font-bold tabular-nums",
                      margin >= 50 ? "text-emerald-600" :
                      margin >= 30 ? "text-lime-600" :
                      margin >= 15 ? "text-amber-600" : "text-rose-600"
                    )}>
                      {margin.toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Star className="size-3 fill-amber-500 text-amber-500" />
                  <span className="tabular-nums">{p.rating.toFixed(1)}</span>
                  <span className="text-slate-300 tabular-nums">({p.reviewCount})</span>
                  {admin && Math.abs(livePrice - adminSell) > 0.05 && (
                    <span className="ml-auto text-[9px] text-amber-600 font-bold tabular-nums">
                      Δ {formatEuro(livePrice - adminSell)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
