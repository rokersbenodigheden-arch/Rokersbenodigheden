import { buildStats } from "@/lib/products";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const s = buildStats();

  const kpis = [
    { label: "Totaal SKU's",      value: s.totalSkus },
    { label: "Unieke producten",  value: s.uniqueProducts },
    { label: "Productfamilies",   value: s.families },
    { label: "Categorieën",       value: s.categories },
    { label: "Merken",            value: s.brands },
    { label: "Actief",            value: s.active },
  ];

  const maxFamilyTotal = Math.max(...s.perFamily.map((f) => f.total), 1);
  const maxCatTotal = Math.max(...s.topCategories.map((c) => c.total), 1);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

      <div className="mb-8 sm:mb-10">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 mb-2">
          Dashboard
        </p>
        <h1 className="font-black text-3xl sm:text-4xl text-slate-900 tracking-tight mb-2">
          Productoverzicht
        </h1>
        <p className="text-slate-500 text-sm">
          Snel overzicht van het complete assortiment.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
              {k.label}
            </p>
            <p className="font-black text-2xl sm:text-3xl text-slate-900 tabular-nums tracking-tight">
              {k.value.toLocaleString("nl-NL")}
            </p>
          </div>
        ))}
      </div>

      {/* Per family */}
      <section className="mb-10">
        <h2 className="font-black text-lg sm:text-xl text-slate-900 tracking-tight mb-4">
          Per productfamilie
        </h2>
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Familie</th>
                <th className="px-4 py-2.5 text-right">Uniek</th>
                <th className="px-4 py-2.5 text-right">Totaal SKU's</th>
                <th className="px-4 py-2.5 text-right">Categorieën</th>
                <th className="px-4 py-2.5 text-right">Merken</th>
                <th className="px-4 py-2.5 text-left">Populairste merk</th>
              </tr>
            </thead>
            <tbody>
              {s.perFamily.map((f) => (
                <tr key={f.family} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span>{f.emoji}</span>
                      <span className="font-bold text-slate-900">{f.family}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${(f.total / maxFamilyTotal) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{f.unique.toLocaleString("nl-NL")}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{f.total.toLocaleString("nl-NL")}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{f.categories}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{f.brands}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{f.topBrand}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top categories */}
      <section>
        <h2 className="font-black text-lg sm:text-xl text-slate-900 tracking-tight mb-4">
          Top 15 categorieën op aantal SKU's
        </h2>
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left w-8">#</th>
                <th className="px-4 py-2.5 text-left">Categorie</th>
                <th className="px-4 py-2.5 text-left">Familie</th>
                <th className="px-4 py-2.5 text-right">Uniek</th>
                <th className="px-4 py-2.5 text-right">Totaal SKU's</th>
                <th className="px-4 py-2.5 text-left">Verdeling</th>
              </tr>
            </thead>
            <tbody>
              {s.topCategories.map((c, i) => (
                <tr key={c.category} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 text-slate-400 tabular-nums">{i + 1}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{c.category}</td>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{c.emoji} {c.family.split(" ")[0]}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{c.unique.toLocaleString("nl-NL")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900">{c.total.toLocaleString("nl-NL")}</td>
                  <td className="px-4 py-2.5 w-[200px]">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", c.family === "VAPING" ? "bg-blue-500" : c.family === "AANSTEKERS" ? "bg-amber-500" : c.family === "E-LIQUIDS" ? "bg-cyan-500" : c.family === "ROOK-ACCESSOIRES" ? "bg-emerald-500" : "bg-slate-400")}
                        style={{ width: `${(c.total / maxCatTotal) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
