"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X, Package, Tag, Hash, Truck, Boxes, ChevronRight, Store, ExternalLink, Check } from "lucide-react";
import { PRODUCTS, getSiteListing, shopProductUrl, type Product } from "@/lib/products";
import { cn, formatEuro, formatPercent, marginColor } from "@/lib/utils";

const FAMILIES = ["AANSTEKERS", "VAPING", "E-LIQUIDS", "ROOK-ACCESSOIRES", "BATTERIJEN & OPLADERS", "OVERIG"] as const;
const FAMILY_EMOJI: Record<string, string> = {
  "AANSTEKERS": "🔥",
  "VAPING": "💨",
  "E-LIQUIDS": "🧴",
  "ROOK-ACCESSOIRES": "🚬",
  "BATTERIJEN & OPLADERS": "⚡",
  "OVERIG": "📦",
};

function tokenize(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

function matches(p: Product, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const hay = `${p.name} ${p.brand} ${p.category} ${p.subcategory} ${p.sku} ${p.ean}`.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

export default function ZoekerPage() {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<string>("");
  const [brand, setBrand] = useState<string>("");
  const [active, setActive] = useState<Product | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close suggestions on outside click / Escape
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        suggestRef.current && !suggestRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setSuggestOpen(false);
      }
    }
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") setSuggestOpen(false);
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", key);
    };
  }, []);

  // Brand list scoped to current family selection
  const brands = useMemo(() => {
    const list = family ? PRODUCTS.filter((p) => p.family === family) : PRODUCTS;
    const counts = new Map<string, number>();
    for (const p of list) {
      if (!p.brand) continue;
      counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [family]);

  const tokens = tokenize(query);

  const results = useMemo(() => {
    let list: Product[] = PRODUCTS;
    if (family) list = list.filter((p) => p.family === family);
    if (brand) list = list.filter((p) => p.brand === brand);
    list = list.filter((p) => matches(p, tokens));
    // Score: exact name token match > brand match > sku match
    if (tokens.length) {
      list = [...list].sort((a, b) => {
        const score = (p: Product) => {
          let s = 0;
          const nameLower = p.name.toLowerCase();
          for (const t of tokens) {
            if (nameLower.startsWith(t)) s += 5;
            else if (nameLower.includes(" " + t)) s += 3;
            if (p.brand.toLowerCase().startsWith(t)) s += 4;
            if (p.sku.toLowerCase().startsWith(t)) s += 6;
          }
          return s;
        };
        return score(b) - score(a);
      });
    }
    return list;
  }, [tokens, family, brand]);

  const visible = results.slice(0, 60);

  // ── Suggestion engine ─────────────────────────────────────────────
  // Returns up to N matches per kind. A match is any string that contains
  // the typed prefix as a substring (case-insensitive), so partial / typo-
  // adjacent inputs still surface meaningful starting points.
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return { brands: [], categories: [], products: [] as Product[] };

    // Brand suggestions — frequency-weighted
    const brandMap = new Map<string, number>();
    for (const p of PRODUCTS) {
      if (!p.brand) continue;
      const b = p.brand;
      if (b.toLowerCase().includes(q)) brandMap.set(b, (brandMap.get(b) ?? 0) + 1);
    }
    const brandHits = [...brandMap.entries()]
      .sort((a, b) => {
        const aStarts = a[0].toLowerCase().startsWith(q) ? 1 : 0;
        const bStarts = b[0].toLowerCase().startsWith(q) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
        return b[1] - a[1];
      })
      .slice(0, 4);

    // Category suggestions
    const catMap = new Map<string, number>();
    for (const p of PRODUCTS) {
      if (!p.category) continue;
      if (p.category.toLowerCase().includes(q)) catMap.set(p.category, (catMap.get(p.category) ?? 0) + 1);
    }
    const catHits = [...catMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Product suggestions — pull from already-scored results
    const productHits = results.slice(0, 6);

    return { brands: brandHits, categories: catHits, products: productHits };
  }, [query, results]);

  const showSuggestions = suggestOpen && query.trim().length > 0 && (
    suggestions.brands.length > 0 || suggestions.categories.length > 0 || suggestions.products.length > 0
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

      {/* ── Hero / heading ── */}
      <div className="mb-8 sm:mb-10">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 mb-2">
          Productzoeker
        </p>
        <h1 className="font-black text-3xl sm:text-4xl text-slate-900 tracking-tight mb-2">
          Zoek in {PRODUCTS.length.toLocaleString("nl-NL")} producten
        </h1>
        <p className="text-slate-500 text-sm">
          Type een productnaam, merk, SKU of EAN — resultaten verschijnen direct.
        </p>
      </div>

      {/* ── Search box + suggestions ── */}
      <div className="relative mb-6">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 pointer-events-none z-10" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onFocus={() => setSuggestOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setSuggestOpen(true); }}
          placeholder="Type een merk, productnaam, SKU of categorie — suggesties verschijnen direct…"
          className="w-full h-14 sm:h-16 pl-14 pr-14 rounded-2xl border border-slate-200 bg-white text-slate-900 text-[15px] sm:text-base outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 transition-all"
        />
        {query && (
          <button
            type="button"
            aria-label="Wissen"
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 size-9 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 flex items-center justify-center transition-colors z-10"
          >
            <X className="size-4" />
          </button>
        )}

        {/* Suggestion dropdown */}
        {showSuggestions && (
          <div
            ref={suggestRef}
            className="absolute z-30 left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Brands */}
            {suggestions.brands.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Merken</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.brands.map(([b, count]) => (
                    <button
                      type="button"
                      key={b}
                      onClick={() => {
                        setBrand(b);
                        setQuery("");
                        setSuggestOpen(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-amber-500 hover:bg-amber-50 text-[12px] font-semibold text-slate-700 hover:text-amber-700 transition-colors"
                    >
                      <Tag className="size-3.5 text-slate-400" />
                      {b}
                      <span className="text-slate-400 tabular-nums">({count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            {suggestions.categories.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Categorieën</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.categories.map(([c, count]) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => {
                        setQuery(c);
                        setSuggestOpen(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-amber-500 hover:bg-amber-50 text-[12px] font-semibold text-slate-700 hover:text-amber-700 transition-colors"
                    >
                      <Boxes className="size-3.5 text-slate-400" />
                      {c}
                      <span className="text-slate-400 tabular-nums">({count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Product hits */}
            {suggestions.products.length > 0 && (
              <div className="px-2 py-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 px-2">Producten</p>
                <ul className="flex flex-col">
                  {suggestions.products.map((p) => (
                    <li key={p.sku}>
                      <button
                        type="button"
                        onClick={() => { setActive(p); setSuggestOpen(false); }}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors group"
                      >
                        <div className="relative size-12 shrink-0 rounded-md bg-slate-50 overflow-hidden border border-slate-100">
                          {p.image ? (
                            <Image
                              src={p.image}
                              alt={p.name}
                              fill
                              sizes="48px"
                              className="object-contain p-1.5"
                              style={{ mixBlendMode: "multiply" }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                              <Package className="size-4" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            {p.familyEmoji} {p.brand}
                          </p>
                          <p className="text-[13px] font-semibold text-slate-900 truncate">{p.name}</p>
                        </div>
                        <span className="text-[12px] font-bold text-slate-900 tabular-nums shrink-0">
                          {formatEuro(p.sell)}
                        </span>
                        <ChevronRight className="size-3.5 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">
              <span className="font-bold text-slate-900 tabular-nums">{results.length.toLocaleString("nl-NL")}</span> producten matchen je zoekopdracht
              <span className="text-slate-400"> — druk Enter om alles te zien</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Family chips ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => { setFamily(""); setBrand(""); }}
          className={cn(
            "px-3.5 py-1.5 rounded-full border text-[12px] font-bold uppercase tracking-wider transition-colors",
            !family
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900"
          )}
        >
          Alle families
        </button>
        {FAMILIES.map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => { setFamily(family === f ? "" : f); setBrand(""); }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[12px] font-bold uppercase tracking-wider transition-colors",
              family === f
                ? "border-amber-600 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-amber-400 hover:text-amber-700"
            )}
          >
            <span>{FAMILY_EMOJI[f]}</span>
            {f}
          </button>
        ))}
      </div>

      {/* ── Brand filter (scoped) ── */}
      {brands.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mr-1">
            Merk:
          </span>
          <button
            type="button"
            onClick={() => setBrand("")}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
              !brand
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-900"
            )}
          >
            Alle merken
          </button>
          {brands.slice(0, 16).map(([b, count]) => (
            <button
              type="button"
              key={b}
              onClick={() => setBrand(brand === b ? "" : b)}
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                brand === b
                  ? "border-amber-600 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-white text-slate-500 hover:border-amber-400 hover:text-amber-700"
              )}
            >
              {b}
              <span className="text-slate-400 tabular-nums">({count})</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Results meta ── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-slate-500">
          <span className="font-bold text-slate-900 tabular-nums">{results.length.toLocaleString("nl-NL")}</span>
          {" "}resultaten
          {results.length > visible.length && (
            <span className="text-slate-400"> — eerste {visible.length} getoond</span>
          )}
        </p>
      </div>

      {/* ── Grid of product cards ── */}
      {visible.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-200 rounded-2xl">
          <p className="text-slate-400 text-sm">Geen producten gevonden voor deze zoekopdracht.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {visible.map((p) => (
            <button
              type="button"
              key={p.sku}
              onClick={() => setActive(p)}
              className="group flex flex-col text-left bg-white border border-slate-100 hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-xl overflow-hidden"
            >
              <div className="relative aspect-square bg-slate-50 overflow-hidden">
                {p.image ? (
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-contain p-3 sm:p-4 transition-transform duration-500 group-hover:scale-[1.04]"
                    style={{ mixBlendMode: "multiply" }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                    <Package className="size-10" />
                  </div>
                )}
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur border border-slate-200 text-[9px] font-black uppercase tracking-wider text-slate-700">
                  {p.familyEmoji} {p.family.split(" ")[0]}
                </span>
                {getSiteListing(p.sku) && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                    <Store className="size-2.5" />
                    Live
                  </span>
                )}
              </div>
              <div className="flex flex-col flex-1 p-3 sm:p-3.5 gap-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{p.brand}</p>
                <p className="text-[12px] sm:text-[13px] font-bold text-slate-900 leading-snug line-clamp-2">
                  {p.name}
                </p>
                <p className="text-[10px] text-slate-400 tabular-nums">SKU {p.sku}</p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                  <span className="text-[14px] font-black text-slate-900 tabular-nums">
                    {formatEuro(p.sell)}
                  </span>
                  <span className={cn("text-[11px] font-bold tabular-nums", marginColor(p.margin))}>
                    {formatPercent(p.margin)} marge
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Detail modal ── */}
      {active && <DetailModal product={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function DetailModal({ product: p, onClose }: { product: Product; onClose: () => void }) {
  // Find color/size variants — same brand + same baseName-ish stem
  const variants = useMemo(() => {
    const stem = p.name.split(" - ").slice(0, 2).join(" - ");
    return PRODUCTS.filter(
      (q) => q.brand === p.brand && q.name.startsWith(stem)
    );
  }, [p]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:w-[640px] max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between gap-4 px-5 sm:px-7 pt-6 pb-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 mb-1">
              {p.familyEmoji} {p.family} · {p.category}
            </p>
            <h2 className="font-black text-xl sm:text-2xl text-slate-900 leading-tight tracking-tight">
              {p.name}
            </h2>
            <p className="text-sm text-slate-500 mt-1">{p.brand}</p>
          </div>
          <button
            type="button"
            aria-label="Sluiten"
            onClick={onClose}
            className="size-9 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-7 pb-7 pt-2">
          {/* Image */}
          <div className="relative aspect-[4/3] bg-slate-50 rounded-xl overflow-hidden mb-5">
            {p.image ? (
              <Image
                src={p.image}
                alt={p.name}
                fill
                className="object-contain p-6"
                style={{ mixBlendMode: "multiply" }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                <Package className="size-12" />
              </div>
            )}
          </div>

          {/* Price + margin row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Inkoop</p>
              <p className="font-black text-base text-slate-900 tabular-nums">{formatEuro(p.purchase)}</p>
            </div>
            <div className="rounded-lg bg-slate-900 text-white px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50 mb-1">Verkoop</p>
              <p className="font-black text-base tabular-nums">{formatEuro(p.sell)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700 mb-1">Marge</p>
              <p className={cn("font-black text-base tabular-nums", marginColor(p.margin))}>
                {formatPercent(p.margin)}
              </p>
            </div>
          </div>

          {/* Live on shop */}
          {(() => {
            const live = getSiteListing(p.sku);
            if (!live) return null;
            const livePrice = parseFloat(live.price);
            const adminSell = p.sell ?? 0;
            const diff = livePrice - adminSell;
            return (
              <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center size-6 rounded-full bg-emerald-500 text-white">
                      <Store className="size-3.5" />
                    </span>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
                      Live op de shop
                    </p>
                  </div>
                  <Link
                    href={shopProductUrl(live.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 transition-colors"
                  >
                    Open shop-pagina
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700/70 mb-0.5">Shop-prijs</p>
                    <p className="font-black text-slate-900 tabular-nums">{formatEuro(livePrice)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700/70 mb-0.5">vs. inkoop+marge</p>
                    <p className={cn("font-black tabular-nums", diff >= 0 ? "text-emerald-700" : "text-rose-600")}>
                      {diff >= 0 ? "+" : ""}{formatEuro(diff)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700/70 mb-0.5">Beoordeling</p>
                    <p className="font-black text-slate-900 tabular-nums">★ {live.rating.toFixed(1)} <span className="text-slate-400 font-semibold">({live.reviewCount})</span></p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Identification */}
          <Section title="Identificatie">
            <Row icon={<Hash className="size-3.5" />} label="SKU" value={p.sku} />
            <Row icon={<Hash className="size-3.5" />} label="EAN" value={p.ean || "—"} />
            <Row icon={<Tag className="size-3.5" />} label="Subcategorie" value={p.subcategory || "—"} />
          </Section>

          {/* Logistics */}
          <Section title="Logistiek & status">
            <Row icon={<Boxes className="size-3.5" />} label="Voorraad" value={String(p.stock ?? "—")} />
            <Row icon={<Truck className="size-3.5" />} label="Besteleenheid" value={String(p.orderUnit ?? "—") + (p.minOrder ? ` (min ${p.minOrder})` : "")} />
            <Row icon={<Tag className="size-3.5" />} label="BTW" value={p.vat ? `${p.vat}%` : "—"} />
            <Row icon={<Tag className="size-3.5" />} label="Status" value={p.status || "—"} />
          </Section>

          {/* Channels */}
          <Section title="Verkoopkanalen">
            <Row
              label="eShop"
              value={
                getSiteListing(p.sku) ? (
                  <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-500 text-white">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center size-5 rounded-full bg-rose-500 text-white">
                    <X className="size-3.5" strokeWidth={3} />
                  </span>
                )
              }
            />
            <Row label="Amazon" value={p.amazon || "—"} />
            <Row label="Bol.com" value={p.bol || "—"} />
          </Section>

          {/* Variants */}
          {variants.length > 1 && (
            <Section title={`Varianten (${variants.length})`}>
              <div className="flex flex-col gap-1">
                {variants.map((v) => {
                  const tail = v.name.replace(p.name.split(" - ").slice(0, 2).join(" - "), "").replace(/^ - /, "").trim();
                  return (
                    <div key={v.sku} className="flex items-center justify-between text-[12px] text-slate-600 py-1 border-b border-slate-50 last:border-0">
                      <span className="truncate flex-1">{tail || v.name}</span>
                      <span className="text-slate-400 tabular-nums shrink-0 ml-3">{v.sku}</span>
                      <span className="font-bold text-slate-900 tabular-nums shrink-0 ml-3 w-16 text-right">{formatEuro(v.sell)}</span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Description */}
          {p.description && (
            <Section title="Omschrijving">
              <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-line">
                {p.description}
              </p>
            </Section>
          )}

          {/* Notes */}
          {p.notes && (
            <Section title="Notities">
              <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-line">
                {p.notes}
              </p>
            </Section>
          )}

        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2">
        {title}
      </p>
      <div>{children}</div>
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px] py-1.5 border-b border-slate-50 last:border-0">
      <span className="flex items-center gap-2 text-slate-500 shrink-0">
        {icon}
        {label}
      </span>
      <span className="text-slate-900 font-semibold text-right truncate">{value}</span>
    </div>
  );
}

// Suppress an unused-warning import
void ChevronRight;
