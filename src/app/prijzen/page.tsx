"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, Loader2, Lock, RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const BTW = 1.21;

type Row = {
  productId: number;
  variantId: number;
  sku: string;
  title: string;
  brand: string;
  category: string;
  price: number;        // incl. btw — the editable one
  compareAt: number | null;
  unitQty: number;
  unitLabel: string;
  inventory: number | null;
  buyUnit: number | null;
  buy: number | null;
  excl: number;
  profit: number | null;
  margin: number | null;
  advice: number | null;
};

const eur = (n: number | null) =>
  n === null || Number.isNaN(n) ? "—" : n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

type SortKey = "sku" | "title" | "brand" | "buy" | "price" | "profit" | "margin";
type Scope = "all" | "sets" | "singles";
type Band = "" | "loss" | "low" | "mid" | "high";
type SaveState = { state: "saving" | "saved" | "error"; message?: string };

export default function PrijzenPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [band, setBand] = useState<Band>("");
  const [sortKey, setSortKey] = useState<SortKey>("margin");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [limit, setLimit] = useState(200);

  const [draft, setDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, SaveState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      if (res.status === 401) { setAuthed(false); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRows(data.rows as Row[]);
      setFetchedAt(data.fetchedAt as string);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/session", { cache: "no-store" });
      const data = await res.json();
      setAuthed(Boolean(data.authed));
    })();
  }, []);

  useEffect(() => { if (authed) void load(); }, [authed, load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) { setLoginError(data.error ?? "Inloggen mislukt"); return; }
    setPassword("");
    setAuthed(true);
  }

  async function savePrice(row: Row) {
    const raw = (draft[row.variantId] ?? "").replace(",", ".").trim();
    if (raw === "") return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      setSaving((s) => ({ ...s, [row.variantId]: { state: "error", message: "Ongeldig bedrag" } }));
      return;
    }
    if (Math.abs(value - row.price) < 0.005) {
      setDraft((d) => { const n = { ...d }; delete n[row.variantId]; return n; });
      return;
    }
    setSaving((s) => ({ ...s, [row.variantId]: { state: "saving" } }));
    try {
      const res = await fetch("/api/prices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
      setTimeout(() => setSaving((s) => { const n = { ...s }; delete n[row.variantId]; return n; }), 2000);
    } catch (e) {
      setSaving((s) => ({ ...s, [row.variantId]: { state: "error", message: (e as Error).message } }));
    }
  }

  const filtered = useMemo(() => {
    let out = rows;
    if (scope === "sets") out = out.filter((r) => r.unitQty > 1);
    if (scope === "singles") out = out.filter((r) => r.unitQty === 1);
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
        const hay = `${r.title} ${r.brand} ${r.sku}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...out].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
      return (((va as number) ?? -Infinity) - ((vb as number) ?? -Infinity)) * dir;
    });
  }, [rows, query, scope, band, sortKey, sortDir]);

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
    const head = ["SKU", "Product", "Merk", "Eenheid", "Stuks", "Inkoop p/stuk", "Inkoop totaal",
      "Verkoop excl", "Verkoop incl", "Winst", "Marge %", "Voorraad"];
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const cs = (v: string) => `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`;
    const cn = (v: number | null) => v === null
      ? `<Cell><Data ss:Type="String"></Data></Cell>`
      : `<Cell><Data ss:Type="Number">${v.toFixed(4)}</Data></Cell>`;
    const body = filtered.map((r) =>
      `<Row>${cs(r.sku)}${cs(r.title)}${cs(r.brand)}${cs(r.unitLabel)}${cn(r.unitQty)}${cn(r.buyUnit)}` +
      `${cn(r.buy)}${cn(r.excl)}${cn(r.price)}${cn(r.profit)}${cn(r.margin)}${cn(r.inventory)}</Row>`).join("");
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
      `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Prijzen"><Table>` +
      `<Row>${head.map((h) => cs(h)).join("")}</Row>${body}</Table></Worksheet></Workbook>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel" }));
    a.download = "prijzen.xls";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Lock screen ──────────────────────────────────────────────────────
  if (authed === null) {
    return <div className="max-w-md mx-auto px-6 py-24 text-center text-slate-500 text-sm">
      <Loader2 className="size-5 animate-spin mx-auto mb-3" />Laden…
    </div>;
  }
  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-6 py-20">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="size-11 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-5">
            <Lock className="size-5" />
          </div>
          <h1 className="font-black text-xl text-slate-900 mb-1">Prijzen bewerken</h1>
          <p className="text-sm text-slate-500 mb-6">
            Deze pagina toont inkoopprijzen en kan winkelprijzen wijzigen. Voer het wachtwoord in.
          </p>
          <form onSubmit={login} className="space-y-3">
            <input
              type="password" value={password} autoFocus
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wachtwoord"
              className="w-full h-11 px-4 rounded-lg border border-slate-200 text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15"
            />
            {loginError && <p className="text-[13px] text-red-600 font-medium">{loginError}</p>}
            <button type="submit"
              className="w-full h-11 rounded-lg bg-slate-900 hover:bg-amber-600 text-white text-[12px] font-bold uppercase tracking-widest transition-colors">
              Ontgrendelen
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Sheet ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 mb-2">Prijslijst — live</p>
          <h1 className="font-black text-3xl sm:text-4xl text-slate-900 tracking-tight mb-2">
            Inkoop tegenover verkoop
          </h1>
          <p className="text-slate-500 text-sm max-w-2xl">
            Klik op een bedrag in <strong>Verkoop incl.</strong> om het te wijzigen — de prijs gaat direct naar
            de webshop. Een set van 4 is één regel met de inkoop van 4 stuks. Marges zijn excl. btw.
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <button type="button" onClick={() => void load()} disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[12px] font-bold uppercase tracking-widest text-slate-700 disabled:opacity-50">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Ververs
          </button>
          <button type="button" onClick={exportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-amber-600 text-white text-[12px] font-bold uppercase tracking-widest transition-colors">
            <Download className="size-4" /> Excel
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          Kon prijzen niet laden: {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Stat label="Regels" value={totals.count.toLocaleString("nl-NL")} />
        <Stat label="Inkoopwaarde" value={eur(totals.buy)} />
        <Stat label="Verkoopwaarde excl." value={eur(totals.sell)} />
        <Stat label="Brutowinst" value={eur(totals.profit)} accent />
        <Stat label="Gem. marge" value={pct(totals.margin)} accent />
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter op product, merk of SKU…"
            className="w-full h-11 pl-11 pr-11 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15" />
          {query && <button type="button" aria-label="Wissen" onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 size-7 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 flex items-center justify-center">
            <X className="size-3.5" /></button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {([["all", "Alles"], ["sets", "Sets"], ["singles", "Losse stuks"]] as [Scope, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setScope(k)}
              className={cn("px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider",
                scope === k ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")}>
              {l}
            </button>
          ))}
          {([["", "Alle marges"], ["loss", "Verlies"], ["low", "< 25%"], ["mid", "25–35%"], ["high", "> 35%"]] as [Band, string][]).map(([k, l]) => (
            <button key={k || "any"} type="button" onClick={() => setBand(k)}
              className={cn("px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider",
                band === k ? "border-amber-600 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600 hover:border-amber-400")}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-[12px] border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider">
                <Th label="SKU" k="sku" {...{ sortKey, sortDir, toggleSort }} />
                <Th label="Product" k="title" {...{ sortKey, sortDir, toggleSort }} />
                <Th label="Merk" k="brand" {...{ sortKey, sortDir, toggleSort }} />
                <th className="px-3 py-2.5 text-left border-r border-slate-700">Eenheid</th>
                <Th label="Inkoop tot." k="buy" {...{ sortKey, sortDir, toggleSort }} align="right" />
                <th className="px-3 py-2.5 text-right border-r border-slate-700">Verkoop excl.</th>
                <Th label="Verkoop incl." k="price" {...{ sortKey, sortDir, toggleSort }} align="right" />
                <Th label="Winst" k="profit" {...{ sortKey, sortDir, toggleSort }} align="right" />
                <Th label="Marge" k="margin" {...{ sortKey, sortDir, toggleSort }} align="right" />
                <th className="px-3 py-2.5 text-right">Voorraad</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {loading && rows.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-slate-400">
                  <Loader2 className="size-5 animate-spin mx-auto mb-2" />Live prijzen ophalen…
                </td></tr>
              )}
              {filtered.slice(0, limit).map((r, i) => {
                const st = saving[r.variantId];
                const dirty = draft[r.variantId] !== undefined;
                return (
                  <tr key={r.variantId} className={cn("border-b border-slate-200 hover:bg-amber-50/50", i % 2 && "bg-slate-50/70")}>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500 border-r border-slate-200">{r.sku}</td>
                    <td className="px-3 py-1.5 max-w-[360px] border-r border-slate-200">
                      <span className="font-semibold text-slate-900 block truncate">{r.title}</span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap border-r border-slate-200">{r.brand}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap border-r border-slate-200">
                      {r.unitQty > 1
                        ? <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">{r.unitLabel}</span>
                        : <span className="text-slate-400 text-[11px]">1 stuk</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-600 border-r border-slate-200">{eur(r.buy)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-500 border-r border-slate-200">{eur(r.excl)}</td>
                    <td className="px-2 py-1 border-r border-slate-200 bg-amber-50/40">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-slate-400">€</span>
                        <input
                          inputMode="decimal"
                          value={draft[r.variantId] ?? r.price.toFixed(2).replace(".", ",")}
                          onChange={(e) => setDraft((d) => ({ ...d, [r.variantId]: e.target.value }))}
                          onFocus={(e) => e.currentTarget.select()}
                          onBlur={() => dirty && void savePrice(r)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.currentTarget.blur(); }
                            if (e.key === "Escape") {
                              setDraft((d) => { const n = { ...d }; delete n[r.variantId]; return n; });
                              e.currentTarget.blur();
                            }
                          }}
                          className={cn("w-20 text-right font-bold rounded px-1.5 py-1 outline-none border bg-white",
                            dirty ? "border-amber-500 ring-2 ring-amber-500/20 text-amber-900"
                              : "border-transparent hover:border-slate-300 text-slate-900",
                            st?.state === "error" && "border-red-500 ring-2 ring-red-500/20")}
                        />
                        <span className="w-4 shrink-0">
                          {st?.state === "saving" && <Loader2 className="size-3.5 animate-spin text-amber-600" />}
                          {st?.state === "saved" && <Check className="size-3.5 text-emerald-600" />}
                          {st?.state === "error" && <span title={st.message} className="text-red-600 font-bold">!</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-slate-900 border-r border-slate-200">{eur(r.profit)}</td>
                    <td className={cn("px-3 py-1.5 text-right font-black border-r border-slate-200",
                      r.margin === null ? "text-slate-400"
                        : r.margin <= 0 ? "bg-red-100 text-red-800"
                          : r.margin < 0.25 ? "bg-red-50 text-red-700"
                            : r.margin <= 0.35 ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700")}>{pct(r.margin)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-500">{r.inventory ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                <td className="px-3 py-2" colSpan={4}>TOTAAL — {totals.count.toLocaleString("nl-NL")} regels</td>
                <td className="px-3 py-2 text-right">{eur(totals.buy)}</td>
                <td className="px-3 py-2 text-right">{eur(totals.sell)}</td>
                <td />
                <td className="px-3 py-2 text-right">{eur(totals.profit)}</td>
                <td className="px-3 py-2 text-right">{pct(totals.margin)}</td>
                <td />
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
            Toon meer ({(filtered.length - limit).toLocaleString("nl-NL")})
          </button>
        )}
        <button type="button"
          onClick={async () => { await fetch("/api/session", { method: "DELETE" }); setAuthed(false); setRows([]); }}
          className="text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700">
          Vergrendelen
        </button>
      </div>
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
