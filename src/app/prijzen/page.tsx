"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Download, Loader2, Lock, Pencil, RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const BTW = 1.21;
const UNCATEGORISED = "__none";

type Row = {
  productId: number;
  variantId: number;
  sku: string;
  title: string;
  brand: string;
  price: number;        // incl. btw — the editable one
  unitQty: number;
  unitLabel: string;
  inventory: number | null;
  buyUnit: number | null;
  buy: number | null;
  excl: number;
  profit: number | null;
  margin: number | null;
  collections: string[];
};
type TreeNode = { handle: string; label: string; children: { handle: string; label: string }[] };

const eur = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const marginClass = (m: number | null) =>
  m === null ? "text-slate-400"
    : m <= 0 ? "bg-red-100 text-red-800"
      : m < 0.25 ? "bg-red-50 text-red-700"
        : m <= 0.35 ? "bg-amber-50 text-amber-700"
          : "bg-emerald-50 text-emerald-700";

type SortKey = "sku" | "title" | "brand" | "buy" | "price" | "profit" | "margin";
type SaveState = { state: "saving" | "saved" | "error"; message?: string };

export default function PrijzenPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [cat, setCat] = useState<string>("");      // selected collection handle
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [limit, setLimit] = useState(200);

  const [draft, setDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, SaveState>>({});

  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      if (res.status === 401) { setAuthed(false); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRows(data.rows as Row[]);
      setTree((data.tree ?? []) as TreeNode[]);
      setFetchedAt(data.fetchedAt as string);
    } catch (e) { setLoadError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/session", { cache: "no-store" });
      setAuthed(Boolean((await res.json()).authed));
    })();
  }, []);
  useEffect(() => { if (authed) void load(); }, [authed, load]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setLoginError("");
    const res = await fetch("/api/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) { setLoginError(data.error ?? "Inloggen mislukt"); return; }
    setPassword(""); setAuthed(true);
  }

  async function savePrice(row: Row) {
    const raw = (draft[row.variantId] ?? "").replace(",", ".").trim();
    if (raw === "") return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      setSaving((s) => ({ ...s, [row.variantId]: { state: "error", message: "Ongeldig bedrag" } })); return;
    }
    if (Math.abs(value - row.price) < 0.005) {
      setDraft((d) => { const n = { ...d }; delete n[row.variantId]; return n; }); return;
    }
    setSaving((s) => ({ ...s, [row.variantId]: { state: "saving" } }));
    try {
      const res = await fetch("/api/prices", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: row.variantId, price: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const saved = Number(data.price);
      setRows((rs) => rs.map((r) => {
        if (r.variantId !== row.variantId) return r;
        const excl = saved / BTW;
        const profit = r.buy === null ? null : excl - r.buy;
        return { ...r, price: saved, excl, profit, margin: profit !== null && excl ? profit / excl : null };
      }));
      setDraft((d) => { const n = { ...d }; delete n[row.variantId]; return n; });
      setSaving((s) => ({ ...s, [row.variantId]: { state: "saved" } }));
      setTimeout(() => setSaving((s) => { const n = { ...s }; delete n[row.variantId]; return n; }), 2500);
    } catch (e) {
      setSaving((s) => ({ ...s, [row.variantId]: { state: "error", message: (e as Error).message } }));
    }
  }

  /** Preview of what a typed amount does to winst/marge, before saving. */
  function preview(row: Row) {
    const raw = draft[row.variantId];
    if (raw === undefined) return null;
    const v = Number(raw.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0 || row.buy === null) return null;
    const excl = v / BTW;
    const profit = excl - row.buy;
    return { price: v, excl, profit, margin: excl ? profit / excl : null };
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) for (const h of r.collections) c[h] = (c[h] ?? 0) + 1;
    return c;
  }, [rows]);

  /** Products that sit in none of the tree's collections — reachable via "Niet ingedeeld". */
  const uncategorised = useMemo(() => rows.filter((r) => r.collections.length === 0).length, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (cat === UNCATEGORISED) out = out.filter((r) => r.collections.length === 0);
    else if (cat) out = out.filter((r) => r.collections.includes(cat));
    const q = query.toLowerCase().trim();
    if (q) {
      const tokens = q.split(/\s+/);
      out = out.filter((r) => tokens.every((t) => `${r.title} ${r.brand} ${r.sku}`.toLowerCase().includes(t)));
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...out].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
      return (((va as number) ?? -Infinity) - ((vb as number) ?? -Infinity)) * dir;
    });
  }, [rows, cat, query, sortKey, sortDir]);

  const totals = useMemo(() => {
    const ok = filtered.filter((r) => r.buy !== null);
    const buy = ok.reduce((s, r) => s + (r.buy ?? 0), 0);
    const sell = ok.reduce((s, r) => s + r.excl, 0);
    return { count: filtered.length, buy, sell, profit: sell - buy, margin: sell ? (sell - buy) / sell : 0 };
  }, [filtered]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "sku" || k === "title" || k === "brand" ? "asc" : "desc"); }
  }

  function exportExcel() {
    const head = ["SKU", "Product", "Merk", "Eenheid", "Inkoop totaal", "Verkoop excl", "Verkoop incl", "Winst", "Marge %"];
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const cs = (v: string) => `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`;
    const cn = (v: number | null) => v === null ? `<Cell><Data ss:Type="String"></Data></Cell>`
      : `<Cell><Data ss:Type="Number">${v.toFixed(4)}</Data></Cell>`;
    const body = filtered.map((r) => `<Row>${cs(r.sku)}${cs(r.title)}${cs(r.brand)}${cs(r.unitLabel)}` +
      `${cn(r.buy)}${cn(r.excl)}${cn(r.price)}${cn(r.profit)}${cn(r.margin)}</Row>`).join("");
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
      `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Prijzen"><Table>` +
      `<Row>${head.map(cs).join("")}</Row>${body}</Table></Worksheet></Workbook>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel" }));
    a.download = `prijzen${cat ? "-" + cat : ""}.xls`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  if (authed === null) {
    return <div className="max-w-md mx-auto px-6 py-24 text-center text-slate-500 text-sm">
      <Loader2 className="size-5 animate-spin mx-auto mb-3" />Laden…</div>;
  }
  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-6 py-20">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="size-11 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-5"><Lock className="size-5" /></div>
          <h1 className="font-black text-xl text-slate-900 mb-1">Prijzen bewerken</h1>
          <p className="text-sm text-slate-500 mb-6">Deze pagina toont inkoopprijzen en kan winkelprijzen wijzigen.</p>
          <form onSubmit={login} className="space-y-3">
            <input type="password" value={password} autoFocus onChange={(e) => setPassword(e.target.value)}
              placeholder="Wachtwoord"
              className="w-full h-11 px-4 rounded-lg border border-slate-200 text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15" />
            {loginError && <p className="text-[13px] text-red-600 font-medium">{loginError}</p>}
            <button type="submit" className="w-full h-11 rounded-lg bg-slate-900 hover:bg-amber-600 text-white text-[12px] font-bold uppercase tracking-widest transition-colors">
              Ontgrendelen
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeLabel = !cat ? "Alle producten"
    : cat === UNCATEGORISED ? "Niet ingedeeld"
    : tree.find((n) => n.handle === cat)?.label
    ?? tree.flatMap((n) => n.children).find((c) => c.handle === cat)?.label
    ?? cat;

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 mb-2">Prijslijst — live</p>
          <h1 className="font-black text-3xl text-slate-900 tracking-tight">Prijzen per categorie</h1>
        </div>
        <div className="flex gap-2 self-start">
          <button type="button" onClick={() => void load()} disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[12px] font-bold uppercase tracking-widest text-slate-700 disabled:opacity-50">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Ververs
          </button>
          <button type="button" onClick={exportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-amber-600 text-white text-[12px] font-bold uppercase tracking-widest">
            <Download className="size-4" /> Excel
          </button>
        </div>
      </div>

      {/* How to change a price */}
      <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-amber-800 mb-2">Zo wijzig je een prijs</p>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] text-amber-900">
          <li className="inline-flex items-center gap-1.5"><Step n={1} /> Klik op het bedrag in de gele kolom
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border-2 border-amber-500 bg-white font-bold text-slate-900">€ 5,25 <Pencil className="size-3 text-amber-600" /></span></li>
          <li className="inline-flex items-center gap-1.5"><Step n={2} /> Typ het nieuwe bedrag</li>
          <li className="inline-flex items-center gap-1.5"><Step n={3} /> Druk <Kbd>Enter</Kbd> — de webshop is direct bijgewerkt</li>
          <li className="inline-flex items-center gap-1.5 text-amber-700">of <Kbd>Esc</Kbd> om te annuleren</li>
        </ol>
      </div>

      {loadError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">Kon prijzen niet laden: {loadError}</div>}

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Category tree */}
        <aside className="lg:w-64 shrink-0">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden lg:sticky lg:top-20">
            <p className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 border-b border-slate-200">Categorieën</p>
            <nav className="p-1.5 max-h-[60vh] overflow-y-auto">
              <CatButton label="Alle producten" count={rows.length} active={!cat} onClick={() => setCat("")} bold />
              {tree.map((node) => {
                const isOpen = open[node.handle] ?? true;
                return (
                  <div key={node.handle} className="mt-0.5">
                    <div className="flex items-stretch">
                      {node.children.length > 0 && (
                        <button type="button" aria-label="Uitklappen"
                          onClick={() => setOpen((o) => ({ ...o, [node.handle]: !isOpen }))}
                          className="px-1 text-slate-400 hover:text-slate-700">
                          <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
                        </button>
                      )}
                      <div className={cn("flex-1", node.children.length === 0 && "ml-[22px]")}>
                        <CatButton label={node.label} count={counts[node.handle] ?? 0}
                          active={cat === node.handle} onClick={() => setCat(node.handle)} bold />
                      </div>
                    </div>
                    {isOpen && node.children.map((c) => (
                      <div key={c.handle} className="ml-[22px]">
                        <CatButton label={c.label} count={counts[c.handle] ?? 0}
                          active={cat === c.handle} onClick={() => setCat(c.handle)} />
                      </div>
                    ))}
                  </div>
                );
              })}
              {uncategorised > 0 && (
                <div className="mt-1 pt-1 border-t border-slate-100 ml-[22px]">
                  <CatButton label="Niet ingedeeld" count={uncategorised}
                    active={cat === UNCATEGORISED} onClick={() => setCat(UNCATEGORISED)} />
                </div>
              )}
            </nav>
          </div>
        </aside>

        {/* Sheet */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
            <h2 className="font-black text-lg text-slate-900">{activeLabel}
              <span className="ml-2 text-slate-400 font-bold text-sm">{totals.count} producten</span></h2>
            <div className="relative sm:ml-auto sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek in deze categorie…"
                className="w-full h-10 pl-10 pr-9 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15" />
              {query && <button type="button" aria-label="Wissen" onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-6 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 flex items-center justify-center"><X className="size-3" /></button>}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Inkoopwaarde" value={eur(totals.buy)} />
            <Stat label="Verkoop excl. btw" value={eur(totals.sell)} />
            <Stat label="Brutowinst" value={eur(totals.profit)} accent />
            <Stat label="Gem. marge" value={pct(totals.margin)} accent />
          </div>

          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
            <div className="overflow-auto max-h-[65vh]">
              <table className="w-full text-[12px] border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider">
                    <Th label="Product" k="title" {...{ sortKey, sortDir, toggleSort }} />
                    <Th label="Merk" k="brand" {...{ sortKey, sortDir, toggleSort }} />
                    <th className="px-3 py-2.5 text-left border-r border-slate-700">Eenheid</th>
                    <Th label="Inkoop" k="buy" {...{ sortKey, sortDir, toggleSort }} align="right" />
                    <th className="px-3 py-2.5 text-center border-r border-slate-700 bg-amber-500 text-slate-900">
                      <span className="inline-flex items-center gap-1"><Pencil className="size-3" /> Verkoopprijs</span>
                    </th>
                    <Th label="Winst" k="profit" {...{ sortKey, sortDir, toggleSort }} align="right" />
                    <Th label="Marge" k="margin" {...{ sortKey, sortDir, toggleSort }} align="right" />
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {loading && rows.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">
                      <Loader2 className="size-5 animate-spin mx-auto mb-2" />Live prijzen ophalen…</td></tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Geen producten in deze categorie.</td></tr>
                  )}
                  {filtered.slice(0, limit).map((r, i) => {
                    const st = saving[r.variantId];
                    const dirty = draft[r.variantId] !== undefined;
                    const pv = preview(r);
                    return (
                      <tr key={r.variantId} className={cn("border-b border-slate-200", dirty ? "bg-amber-50" : i % 2 && "bg-slate-50/70")}>
                        <td className="px-3 py-1.5 max-w-[420px] border-r border-slate-200">
                          <span className="font-semibold text-slate-900 block truncate">{r.title}</span>
                          <span className="font-mono text-[10px] text-slate-400">{r.sku}</span>
                        </td>
                        <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap border-r border-slate-200">{r.brand}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap border-r border-slate-200">
                          {r.unitQty > 1
                            ? <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">{r.unitLabel}</span>
                            : <span className="text-slate-400 text-[11px]">1 stuk</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-600 border-r border-slate-200">{eur(r.buy)}</td>

                        {/* The editable cell */}
                        <td className="px-2 py-1 border-r border-slate-200 bg-amber-50/70">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-slate-500 font-semibold">€</span>
                            <input inputMode="decimal" aria-label={`Verkoopprijs ${r.title}`}
                              value={draft[r.variantId] ?? r.price.toFixed(2).replace(".", ",")}
                              onChange={(e) => setDraft((d) => ({ ...d, [r.variantId]: e.target.value }))}
                              onFocus={(e) => e.currentTarget.select()}
                              onBlur={() => dirty && void savePrice(r)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") {
                                  setDraft((d) => { const n = { ...d }; delete n[r.variantId]; return n; });
                                  e.currentTarget.blur();
                                }
                              }}
                              className={cn("w-24 text-right font-bold rounded px-2 py-1.5 outline-none border-2 bg-white transition-colors",
                                dirty ? "border-amber-500 ring-2 ring-amber-400/30 text-amber-900"
                                  : "border-slate-300 hover:border-amber-400 hover:bg-amber-50 text-slate-900 cursor-pointer",
                                st?.state === "error" && "border-red-500 ring-2 ring-red-400/30")} />
                            <span className="w-5 shrink-0 flex items-center">
                              {st?.state === "saving" ? <Loader2 className="size-4 animate-spin text-amber-600" />
                                : st?.state === "saved" ? <Check className="size-4 text-emerald-600" />
                                  : st?.state === "error" ? <span title={st.message} className="text-red-600 font-black">!</span>
                                    : <Pencil className="size-3 text-slate-300" />}
                            </span>
                          </div>
                          {dirty && (
                            <p className="text-[10px] text-amber-800 text-center mt-0.5 font-semibold">
                              Enter = opslaan · Esc = terug
                            </p>
                          )}
                          {st?.state === "error" && <p className="text-[10px] text-red-700 text-center mt-0.5">{st.message}</p>}
                        </td>

                        <td className="px-3 py-1.5 text-right font-semibold border-r border-slate-200">
                          {pv ? <span className="text-amber-800">{eur(pv.profit)}</span> : <span className="text-slate-900">{eur(r.profit)}</span>}
                        </td>
                        <td className={cn("px-3 py-1.5 text-right font-black", marginClass(pv ? pv.margin : r.margin))}>
                          {pct(pv ? pv.margin : r.margin)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0">
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                    <td className="px-3 py-2" colSpan={3}>TOTAAL — {totals.count} producten</td>
                    <td className="px-3 py-2 text-right">{eur(totals.buy)}</td>
                    <td className="px-3 py-2 text-center text-slate-500 text-[11px]">excl. {eur(totals.sell)}</td>
                    <td className="px-3 py-2 text-right">{eur(totals.profit)}</td>
                    <td className="px-3 py-2 text-right">{pct(totals.margin)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-4">
            <p className="text-[11px] text-slate-400">
              {fetchedAt && `Live opgehaald ${new Date(fetchedAt).toLocaleTimeString("nl-NL")}`}
            </p>
            {filtered.length > limit && (
              <button type="button" onClick={() => setLimit(limit + 300)}
                className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[12px] font-bold uppercase tracking-widest text-slate-700">
                Toon meer ({filtered.length - limit})
              </button>
            )}
            <button type="button"
              onClick={async () => { await fetch("/api/session", { method: "DELETE" }); setAuthed(false); setRows([]); }}
              className="text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700">Vergrendelen</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CatButton({ label, count, active, onClick, bold }: {
  label: string; count: number; active: boolean; onClick: () => void; bold?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn("w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-left transition-colors",
        active ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-700")}>
      <span className={cn("text-[12.5px] truncate", bold ? "font-bold" : "font-medium")}>{label}</span>
      <span className={cn("text-[10px] tabular-nums shrink-0 px-1.5 py-0.5 rounded",
        active ? "bg-white/20" : "bg-slate-100 text-slate-500")}>{count}</span>
    </button>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-4 py-2.5", accent ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white")}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">{label}</p>
      <p className={cn("text-base font-black tabular-nums", accent ? "text-amber-700" : "text-slate-900")}>{value}</p>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="size-5 rounded-full bg-amber-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">{n}</span>;
}
function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="px-1.5 py-0.5 rounded border border-amber-400 bg-white text-[11px] font-bold text-amber-900">{children}</kbd>;
}

function Th({ label, k, sortKey, sortDir, toggleSort, align = "left" }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: "asc" | "desc";
  toggleSort: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <th className={cn("px-3 py-2.5 border-r border-slate-700 bg-slate-800", align === "right" ? "text-right" : "text-left")}>
      <button type="button" onClick={() => toggleSort(k)}
        className={cn("inline-flex items-center gap-1 hover:text-amber-400", active && "text-amber-400")}>
        {label}{active && <span className="text-[8px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
