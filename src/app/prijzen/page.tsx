"use client";

import React, { useMemo, useState } from "react";
import { Download, Search, Table2, X } from "lucide-react";
import { PRODUCTS, type Product } from "@/lib/products";
import shopRaw from "@/data/shop-prices.json";
import { cn } from "@/lib/utils";

// ─── Wat de winkel er écht voor vraagt (uit Shopify) ───────────────────
type ShopRow = {
  shopPrice: number;      // incl. 21% btw
  unitQty: number;        // 4 bij een "Set van 4"
  unitLabel: string;
  shopTitle: string;
  onSale: boolean;
  wasPrice: number | null;
  stock: number | null;
};
const SHOP = shopRaw as Record<string, ShopRow>;
const BTW = 1.21;

type Row = {
  sku: string;
  name: string;
  brand: string;
  category: string;
  family: string;
  emoji: string;
  inShop: boolean;
  unitLabel: string;
  unitQty: number;
  /** inkoop per stuk, excl. btw */
  buyUnit: number | null;
  /** inkoop per verkoopeenheid, excl. btw */
  buy: number | null;
  /** wat de klant betaalt, incl. btw (winkelprijs, anders Bookwill-advies) */
  sellIncl: number | null;
  sellExcl: number | null;
  profit: number | null;
  margin: number | null;
  markup: number | null;
  advice: number | null;
  onSale: boolean;
  stock: number | null;
};

function buildRows(): Row[] {
  return (PRODUCTS as Product[]).map((p) => {
    const s = SHOP[p.sku];
    const qty = s?.unitQty ?? 1;
    const buyUnit = p.purchase ?? null;
    const buy = buyUnit === null ? null : buyUnit * qty;
    // In de shop? dan de echte winkelprijs. Anders het Bookwill-advies.
    const sellIncl = s ? s.shopPrice : p.sell ?? null;
    const sellExcl = sellIncl === null ? null : (s ? sellIncl / BTW : sellIncl);
    const profit = buy !== null && sellExcl !== null ? sellExcl - buy : null;
    const margin = profit !== null && sellExcl ? profit / sellExcl : null;
    const markup = buy && sellExcl ? sellExcl / buy : null;
    return {
      sku: p.sku,
      name: s?.shopTitle ?? p.name,
      brand: p.brand,
      category: p.category,
      family: p.family,
      emoji: p.familyEmoji,
      inShop: !!s,
      unitLabel: s?.unitLabel ?? "1 stuk",
      unitQty: qty,
      buyUnit,
      buy,
      sellIncl,
      sellExcl,
      profit,
      margin,
      markup,
      advice: p.sell ?? null,
      onSale: !!s?.onSale,
      stock: s?.stock ?? (typeof p.stock === "number" ? p.stock : null),
    };
  });
}

const ALL_ROWS = buildRows();

const eur = (n: number | null) =>
  n === null || Number.isNaN(n) ? "—" : n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

type SortKey = "sku" | "name" | "brand" | "buy" | "sellIncl" | "profit" | "margin" | "markup" | "stock";
type Scope = "shop" | "sets" | "all";
type Band = "" | "loss" | "low" | "mid" | "high";

const SCOPES: { k: Scope; label: string }[] = [
  { k: "shop", label: "In de winkel" },
  { k: "sets", label: "Alleen sets" },
  { k: "all", label: "Hele feed" },
];
const BANDS: { k: Band; label: string; cls: string }[] = [
  { k: "", label: "Alle marges", cls: "" },
  { k: "loss", label: "Verlies", cls: "text-red-700" },
  { k: "low", label: "< 25%", cls: "text-red-700" },
  { k: "mid", label: "25–35%", cls: "text-amber-700" },
  { k: "high", label: "> 35%", cls: "text-emerald-700" },
];

export default function PrijzenPage() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("shop");
  const [band, setBand] = useState<Band>("");
  const [sortKey, setSortKey] = useState<SortKey>("margin");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [limit, setLimit] = useState(300);

  const rows = useMemo(() => {
    let out = ALL_ROWS;
    if (scope === "shop") out = out.filter((r) => r.inShop);
    if (scope === "sets") out = out.filter((r) => r.unitQty > 1);
    if (band) {
      out = out.filter((r) => {
        if (r.margin === null) return false;
        if (band === "loss") return r.margin <= 0;
        if (band === "low") return r.margin > 0 && r.margin < 0.25;
        if (band === "mid") return r.margin >= 0.25 && r.margin <= 0.35;
        return r.margin > 0.35;
      });
    }
    const q = query.toLowerCase().trim();
    if (q) {
      const tokens = q.split(/\s+/);
      out = out.filter((r) => {
        const hay = `${r.name} ${r.brand} ${r.category} ${r.sku}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...out].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
      return (((va as number) ?? -Infinity) - ((vb as number) ?? -Infinity)) * dir;
    });
  }, [query, scope, band, sortKey, sortDir]);

  const totals = useMemo(() => {
    const withNums = rows.filter((r) => r.buy !== null && r.sellExcl !== null);
    const buy = withNums.reduce((s, r) => s + (r.buy ?? 0), 0);
    const sell = withNums.reduce((s, r) => s + (r.sellExcl ?? 0), 0);
    const profit = sell - buy;
    return { count: rows.length, buy, sell, profit, margin: sell ? profit / sell : 0 };
  }, [rows]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "sku" || k === "name" || k === "brand" ? "asc" : "desc"); }
  }

  /** Echte Excel-export: SpreadsheetML opent direct in Excel/Numbers mét opmaak. */
  function exportExcel() {
    const head = ["SKU", "Product", "Merk", "Verkoop-eenheid", "Stuks", "Inkoop p/stuk",
      "Inkoop p/eenheid", "Verkoop excl", "Verkoop incl", "Winst", "Marge %", "Markup", "Bookwill advies", "Voorraad"];
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const cellS = (v: string) => `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`;
    const cellN = (v: number | null) =>
      v === null ? `<Cell><Data ss:Type="String"></Data></Cell>`
        : `<Cell><Data ss:Type="Number">${v.toFixed(4)}</Data></Cell>`;
    const body = rows.map((r) =>
      `<Row>${cellS(r.sku)}${cellS(r.name)}${cellS(r.brand)}${cellS(r.unitLabel)}${cellN(r.unitQty)}` +
      `${cellN(r.buyUnit)}${cellN(r.buy)}${cellN(r.sellExcl)}${cellN(r.sellIncl)}${cellN(r.profit)}` +
      `${cellN(r.margin)}${cellN(r.markup)}${cellN(r.advice)}${cellN(r.stock)}</Row>`
    ).join("");
    const xml =
      `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
      `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles>` +
      `<Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2B3E51" ss:Pattern="Solid"/></Style>` +
      `</Styles><Worksheet ss:Name="Prijzen"><Table>` +
      `<Row>${head.map((h) => `<Cell ss:StyleID="h"><Data ss:Type="String">${h}</Data></Cell>`).join("")}</Row>` +
      body + `</Table></Worksheet></Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prijzen-${scope}.xls`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const visible = rows.slice(0, limit);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 mb-2">Prijslijst</p>
          <h1 className="font-black text-3xl sm:text-4xl text-slate-900 tracking-tight mb-2">
            Inkoop tegenover verkoop
          </h1>
          <p className="text-slate-500 text-sm max-w-2xl">
            Eén regel per verkoopeenheid — een set van 4 telt als één verkoop met de inkoop van 4 stuks.
            Marges zijn berekend op bedragen <strong>exclusief</strong> btw.
          </p>
        </div>
        <button
          type="button"
          onClick={exportExcel}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-amber-600 text-white text-[12px] font-bold uppercase tracking-widest transition-colors self-start"
        >
          <Download className="size-4" />
          Naar Excel
        </button>
      </div>

      {/* Samenvatting */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Stat label="Regels" value={totals.count.toLocaleString("nl-NL")} />
        <Stat label="Inkoopwaarde" value={eur(totals.buy)} />
        <Stat label="Verkoopwaarde excl." value={eur(totals.sell)} />
        <Stat label="Brutowinst" value={eur(totals.profit)} accent />
        <Stat label="Gem. marge" value={pct(totals.margin)} accent />
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter op product, merk of SKU…"
            className="w-full h-11 pl-11 pr-11 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 transition-all"
          />
          {query && (
            <button type="button" aria-label="Wissen" onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 size-7 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 flex items-center justify-center">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((s) => (
            <button key={s.k} type="button" onClick={() => setScope(s.k)}
              className={cn("px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider transition-colors",
                scope === s.k ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")}>
              {s.label}
            </button>
          ))}
          {BANDS.map((b) => (
            <button key={b.k || "all"} type="button" onClick={() => setBand(b.k)}
              className={cn("px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider transition-colors",
                band === b.k ? "border-amber-600 bg-amber-50 text-amber-700" : cn("border-slate-200 bg-white hover:border-amber-400", b.cls || "text-slate-600"))}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-[12px] border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider">
                <Th label="SKU" k="sku" {...{ sortKey, sortDir, toggleSort }} sticky />
                <Th label="Product" k="name" {...{ sortKey, sortDir, toggleSort }} />
                <Th label="Merk" k="brand" {...{ sortKey, sortDir, toggleSort }} />
                <th className="px-3 py-2.5 text-left border-r border-slate-700">Eenheid</th>
                <Th label="Inkoop p/st" k="buy" {...{ sortKey, sortDir, toggleSort }} align="right" />
                <th className="px-3 py-2.5 text-right border-r border-slate-700">Inkoop totaal</th>
                <th className="px-3 py-2.5 text-right border-r border-slate-700">Verkoop excl.</th>
                <Th label="Verkoop incl." k="sellIncl" {...{ sortKey, sortDir, toggleSort }} align="right" />
                <Th label="Winst" k="profit" {...{ sortKey, sortDir, toggleSort }} align="right" />
                <Th label="Marge" k="margin" {...{ sortKey, sortDir, toggleSort }} align="right" />
                <Th label="Markup" k="markup" {...{ sortKey, sortDir, toggleSort }} align="right" />
                <th className="px-3 py-2.5 text-right">Advies</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {visible.map((r, i) => (
                <tr key={r.sku} className={cn("border-b border-slate-200 hover:bg-amber-50/60", i % 2 && "bg-slate-50/70")}>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500 border-r border-slate-200 sticky left-0 bg-inherit">{r.sku}</td>
                  <td className="px-3 py-1.5 max-w-[380px] border-r border-slate-200">
                    <span className="font-semibold text-slate-900 block truncate">{r.name}</span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap border-r border-slate-200">{r.brand}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap border-r border-slate-200">
                    {r.unitQty > 1
                      ? <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">{r.unitLabel}</span>
                      : <span className="text-slate-400 text-[11px]">1 stuk</span>}
                    {r.onSale && <span className="ml-1 inline-flex px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">sale</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-500 border-r border-slate-200">{eur(r.buyUnit)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-700 border-r border-slate-200">{eur(r.buy)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-500 border-r border-slate-200">{eur(r.sellExcl)}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-slate-900 border-r border-slate-200">{eur(r.sellIncl)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-slate-900 border-r border-slate-200">{eur(r.profit)}</td>
                  <td className={cn("px-3 py-1.5 text-right font-black border-r border-slate-200",
                    r.margin === null ? "text-slate-400"
                      : r.margin <= 0 ? "bg-red-100 text-red-800"
                        : r.margin < 0.25 ? "bg-red-50 text-red-700"
                          : r.margin <= 0.35 ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700")}>
                    {pct(r.margin)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-500 border-r border-slate-200">
                    {r.markup ? `${r.markup.toFixed(2)}×` : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-400">{eur(r.advice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                <td className="px-3 py-2 sticky left-0 bg-slate-100" colSpan={5}>
                  TOTAAL — {totals.count.toLocaleString("nl-NL")} regels
                </td>
                <td className="px-3 py-2 text-right">{eur(totals.buy)}</td>
                <td className="px-3 py-2 text-right">{eur(totals.sell)}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right">{eur(totals.profit)}</td>
                <td className="px-3 py-2 text-right">{pct(totals.margin)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {rows.length > visible.length && (
        <div className="flex justify-center mt-4">
          <button type="button" onClick={() => setLimit(limit + 500)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[12px] font-bold uppercase tracking-widest text-slate-700">
            <Table2 className="size-4" />
            Toon meer ({(rows.length - visible.length).toLocaleString("nl-NL")} resterend)
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-4 py-3", accent ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white")}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className={cn("text-lg font-black tabular-nums", accent ? "text-amber-700" : "text-slate-900")}>{value}</p>
    </div>
  );
}

function Th({ label, k, sortKey, sortDir, toggleSort, align = "left", sticky }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: "asc" | "desc";
  toggleSort: (k: SortKey) => void; align?: "left" | "right"; sticky?: boolean;
}) {
  const active = sortKey === k;
  return (
    <th className={cn("px-3 py-2.5 border-r border-slate-700 bg-slate-800",
      align === "right" ? "text-right" : "text-left", sticky && "sticky left-0 z-10")}>
      <button type="button" onClick={() => toggleSort(k)}
        className={cn("inline-flex items-center gap-1 hover:text-amber-400 transition-colors", active && "text-amber-400")}>
        {label}
        {active && <span className="text-[8px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
