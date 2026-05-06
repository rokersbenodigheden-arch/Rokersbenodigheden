"use client";

import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { buildCatalogus } from "@/lib/products";
import { cn, formatEuro, formatPercent, marginColor } from "@/lib/utils";

const FAMILIES = ["AANSTEKERS", "VAPING", "E-LIQUIDS", "ROOK-ACCESSOIRES", "BATTERIJEN & OPLADERS", "OVERIG"] as const;
const FAMILY_EMOJI: Record<string, string> = {
  "AANSTEKERS": "🔥", "VAPING": "💨", "E-LIQUIDS": "🧴",
  "ROOK-ACCESSOIRES": "🚬", "BATTERIJEN & OPLADERS": "⚡", "OVERIG": "📦",
};

type SortKey = "name" | "purchase" | "sell" | "margin" | "variants";
type SortDir = "asc" | "desc";

export default function CatalogusPage() {
  const allEntries = useMemo(() => buildCatalogus(), []);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let out = allEntries;
    if (family) out = out.filter((c) => c.family === family);
    if (q) {
      const tokens = q.split(/\s+/);
      out = out.filter((c) => {
        const hay = `${c.baseName} ${c.brand} ${c.category} ${c.subcategory}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }
    out = [...out].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":     return a.baseName.localeCompare(b.baseName) * dir;
        case "purchase": return ((a.purchaseMin ?? 0) - (b.purchaseMin ?? 0)) * dir;
        case "sell":     return ((a.sellMin ?? 0) - (b.sellMin ?? 0)) * dir;
        case "margin":   return ((a.marginAvg ?? 0) - (b.marginAvg ?? 0)) * dir;
        case "variants": return (a.variantCount - b.variantCount) * dir;
      }
    });
    return out;
  }, [allEntries, query, family, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

      <div className="mb-6 sm:mb-8">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 mb-2">
          Catalogus
        </p>
        <h1 className="font-black text-3xl sm:text-4xl text-slate-900 tracking-tight mb-2">
          {allEntries.length.toLocaleString("nl-NL")} unieke producten
        </h1>
        <p className="text-slate-500 text-sm">
          Kleurvarianten samengevoegd. Gegroepeerd op productfamilie.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter op naam, merk of categorie…"
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

      {/* Family filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          type="button"
          onClick={() => setFamily("")}
          className={cn(
            "px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider transition-colors",
            !family ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
          )}
        >
          Alle ({allEntries.length})
        </button>
        {FAMILIES.map((f) => {
          const count = allEntries.filter((c) => c.family === f).length;
          if (count === 0) return null;
          return (
            <button
              type="button"
              key={f}
              onClick={() => setFamily(family === f ? "" : f)}
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
        <span className="font-bold text-slate-900 tabular-nums">{filtered.length.toLocaleString("nl-NL")}</span> producten getoond
      </p>

      {/* Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Familie</th>
                <SortableTh label="Product"      k="name"     sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-2.5 text-left">Merk</th>
                <th className="px-3 py-2.5 text-left">Categorie</th>
                <SortableTh label="Inkoop"       k="purchase" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Verkoop"      k="sell"     sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Marge"        k="margin"   sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Varianten"    k="variants" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <th className="px-3 py-2.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((c, i) => {
                const sameMin = c.purchaseMin === c.purchaseMax;
                const sameSell = c.sellMin === c.sellMax;
                return (
                  <tr key={c.brand + c.baseName + i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">{c.familyEmoji}</td>
                    <td className="px-3 py-2 max-w-[420px]">
                      <p className="font-semibold text-slate-900 truncate">{c.baseName}</p>
                      {c.variants.length > 1 && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {c.variants.slice(0, 4).join(" · ")}{c.variants.length > 4 ? "…" : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{c.brand}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{c.category}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500 whitespace-nowrap">
                      {sameMin ? formatEuro(c.purchaseMin) : `${formatEuro(c.purchaseMin)}–${formatEuro(c.purchaseMax)}`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      {sameSell ? formatEuro(c.sellMin) : `${formatEuro(c.sellMin)}–${formatEuro(c.sellMax)}`}
                    </td>
                    <td className={cn("px-3 py-2 text-right tabular-nums font-bold whitespace-nowrap", marginColor(c.marginAvg))}>
                      {formatPercent(c.marginAvg)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500 whitespace-nowrap">
                      {c.variantCount}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c.status?.toLowerCase().startsWith("actief") ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                          Actief
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                          {c.status || "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <p className="px-4 py-3 text-[11px] text-slate-400 bg-slate-50 border-t border-slate-200">
            Eerste 500 van {filtered.length.toLocaleString("nl-NL")} resultaten getoond — verfijn de filter om meer te zien.
          </p>
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
        className={cn(
          "inline-flex items-center gap-1 hover:text-slate-900 transition-colors",
          active && "text-slate-900"
        )}
      >
        {label}
        {active && <span className="text-[8px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
