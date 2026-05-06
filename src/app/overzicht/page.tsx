"use client";

import React, { useMemo, useState } from "react";
import { Search, X, Download } from "lucide-react";
import { PRODUCTS, type Product } from "@/lib/products";
import { cn, formatEuro, formatPercent, marginColor } from "@/lib/utils";

const FAMILIES = ["AANSTEKERS", "VAPING", "E-LIQUIDS", "ROOK-ACCESSOIRES", "BATTERIJEN & OPLADERS", "OVERIG"] as const;
const FAMILY_EMOJI: Record<string, string> = {
  "AANSTEKERS": "🔥", "VAPING": "💨", "E-LIQUIDS": "🧴",
  "ROOK-ACCESSOIRES": "🚬", "BATTERIJEN & OPLADERS": "⚡", "OVERIG": "📦",
};

type SortKey = "name" | "sku" | "purchase" | "sell" | "margin" | "stock";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 100;

export default function OverzichtPage() {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let out: Product[] = PRODUCTS;
    if (family) out = out.filter((p) => p.family === family);
    if (q) {
      const tokens = q.split(/\s+/);
      out = out.filter((p) => {
        const hay = `${p.name} ${p.brand} ${p.category} ${p.subcategory} ${p.sku} ${p.ean}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }
    out = [...out].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":     return a.name.localeCompare(b.name) * dir;
        case "sku":      return a.sku.localeCompare(b.sku) * dir;
        case "purchase": return ((a.purchase ?? 0) - (b.purchase ?? 0)) * dir;
        case "sell":     return ((a.sell ?? 0) - (b.sell ?? 0)) * dir;
        case "margin":   return ((a.margin ?? 0) - (b.margin ?? 0)) * dir;
        case "stock":    return ((Number(a.stock) || 0) - (Number(b.stock) || 0)) * dir;
      }
    });
    return out;
  }, [query, family, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" || k === "sku" ? "asc" : "desc"); }
    setPage(1);
  }

  function downloadCsv() {
    const headers = ["SKU","Product","Merk","Categorie","Subcategorie","Inkoop","Verkoop","Marge","EAN","Status"];
    const rows = filtered.map((p) => [
      p.sku, p.name, p.brand, p.category, p.subcategory,
      p.purchase ?? "", p.sell ?? "", p.margin ?? "", p.ean, p.status,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rokersbenodigheden-skus.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 mb-2">
            Volledig overzicht
          </p>
          <h1 className="font-black text-3xl sm:text-4xl text-slate-900 tracking-tight mb-2">
            {PRODUCTS.length.toLocaleString("nl-NL")} totale SKU's
          </h1>
          <p className="text-slate-500 text-sm">
            Inclusief alle kleur- en groottevarianten.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-amber-600 text-white text-[12px] font-bold uppercase tracking-widest transition-colors self-start"
        >
          <Download className="size-4" />
          Exporteer CSV
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Filter op naam, merk, SKU, EAN…"
          className="w-full h-11 pl-11 pr-11 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 transition-all"
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

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          type="button"
          onClick={() => { setFamily(""); setPage(1); }}
          className={cn(
            "px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider transition-colors",
            !family ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
          )}
        >
          Alle ({PRODUCTS.length})
        </button>
        {FAMILIES.map((f) => {
          const count = PRODUCTS.filter((p) => p.family === f).length;
          if (count === 0) return null;
          return (
            <button
              type="button"
              key={f}
              onClick={() => { setFamily(family === f ? "" : f); setPage(1); }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider transition-colors",
                family === f ? "border-amber-600 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600 hover:border-amber-400 hover:text-amber-700"
              )}
            >
              <span>{FAMILY_EMOJI[f]}</span> {f.split(" ")[0]} ({count})
            </button>
          );
        })}
      </div>

      <p className="text-[12px] text-slate-500 mb-3">
        <span className="font-bold text-slate-900 tabular-nums">{filtered.length.toLocaleString("nl-NL")}</span> SKU's gevonden
        — pagina <span className="font-bold text-slate-900">{safePage}</span> van {totalPages}
      </p>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left w-8"></th>
                <SortableTh label="SKU"        k="sku"      sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Product"    k="name"     sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-2.5 text-left">Merk</th>
                <th className="px-3 py-2.5 text-left">Categorie</th>
                <SortableTh label="Inkoop"     k="purchase" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Verkoop"    k="sell"     sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Marge"      k="margin"   sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Voorraad"   k="stock"    sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <th className="px-3 py-2.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.sku} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <td className="px-3 py-1.5">{p.familyEmoji}</td>
                  <td className="px-3 py-1.5 tabular-nums text-slate-500 whitespace-nowrap font-mono text-[11px]">{p.sku}</td>
                  <td className="px-3 py-1.5 max-w-[400px]">
                    <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{p.brand}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{p.category}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 whitespace-nowrap">{formatEuro(p.purchase)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-bold text-slate-900 whitespace-nowrap">{formatEuro(p.sell)}</td>
                  <td className={cn("px-3 py-1.5 text-right tabular-nums font-bold whitespace-nowrap", marginColor(p.margin))}>{formatPercent(p.margin)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 whitespace-nowrap">{p.stock ?? "—"}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {p.status?.toLowerCase().startsWith("actief") ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                        Actief
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                        {p.status || "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage(safePage - 1)}
              className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Vorige
            </button>
            <span className="text-[11px] text-slate-500">
              {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} van {filtered.length.toLocaleString("nl-NL")}
            </span>
            <button
              type="button"
              disabled={safePage === totalPages}
              onClick={() => setPage(safePage + 1)}
              className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Volgende →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableTh({ label, k, sortKey, sortDir, onClick, align = "left" }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir; onClick: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <th className={cn("px-3 py-2.5", align === "right" ? "text-right" : "text-left")}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={cn("inline-flex items-center gap-1 hover:text-slate-900 transition-colors", active && "text-slate-900")}
      >
        {label}
        {active && <span className="text-[8px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
