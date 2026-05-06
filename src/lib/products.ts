import raw from "@/data/products.json";
import siteRaw from "@/data/site-products.json";

// ─── Live-shop catalog (subset of admin SKUs that are sold publicly) ────
export type SiteProduct = {
  id: number;
  sku: string;
  name: string;
  brand: string;
  price: string;
  oldPrice: string | null;
  image: string;
  category: string;
  rating: number;
  reviewCount: number;
};

export const SITE_PRODUCTS = siteRaw as SiteProduct[];

const SITE_BY_SKU = new Map<string, SiteProduct>();
for (const sp of SITE_PRODUCTS) {
  if (sp.sku) SITE_BY_SKU.set(sp.sku, sp);
}

export function getSiteListing(sku: string): SiteProduct | undefined {
  return SITE_BY_SKU.get(sku);
}

// Public shop URL pattern. Replace with the live domain once it's swapped.
export const SHOP_BASE_URL = "https://tbk-zeta.vercel.app";
export function shopProductUrl(id: number): string {
  return `${SHOP_BASE_URL}/product/${id}`;
}

export type Product = {
  sku: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  purchase: number | null;
  sell: number | null;
  margin: number | null;
  ean: string;
  description: string;
  image: string;
  productUrl: string;
  stock: number | null | string;
  orderUnit: number | null | string;
  minOrder: number | null | string;
  vat: number | null | string;
  status: string;
  eShop: string;
  amazon: string;
  bol: string;
  listing: string;
  notes: string;
  family: "AANSTEKERS" | "VAPING" | "E-LIQUIDS" | "ROOK-ACCESSOIRES" | "BATTERIJEN & OPLADERS" | "OVERIG";
  familyEmoji: string;
};

export const PRODUCTS = raw as unknown as Product[];

// Group SKUs by name "stem" so e.g. five color variants of one Zippo are
// merged into a single catalogus entry. The variant differentiator is
// usually the trailing "- Color" / "- Size" tail; we strip it heuristically.
export type CatalogusEntry = {
  baseName: string;
  brand: string;
  family: Product["family"];
  familyEmoji: string;
  category: string;
  subcategory: string;
  purchaseMin: number | null;
  purchaseMax: number | null;
  sellMin: number | null;
  sellMax: number | null;
  marginAvg: number | null;
  status: string;
  variantCount: number;
  variants: string[];
  representative: Product;
  skus: string[];
};

function stem(name: string): string {
  // Drop trailing variant tails (everything after the last " - " when it
  // contains a small obvious variant tag like a size, color, finish, code).
  const trimmed = name.trim();
  const parts = trimmed.split(" - ");
  if (parts.length <= 2) return trimmed;
  // Keep the first 2 segments as the stem
  return parts.slice(0, 2).join(" - ");
}

let cachedCatalogus: CatalogusEntry[] | null = null;

export function buildCatalogus(): CatalogusEntry[] {
  if (cachedCatalogus) return cachedCatalogus;
  const groups = new Map<string, Product[]>();
  for (const p of PRODUCTS) {
    const key = `${p.brand}::${stem(p.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const out: CatalogusEntry[] = [];
  for (const [, list] of groups) {
    const rep = list[0];
    const variants = list.map((p) => {
      const tail = p.name.replace(stem(p.name), "").replace(/^ - /, "").trim();
      return tail || "Standaard";
    });
    const purchases = list.map((p) => p.purchase).filter((v): v is number => typeof v === "number");
    const sells = list.map((p) => p.sell).filter((v): v is number => typeof v === "number");
    const margins = list.map((p) => p.margin).filter((v): v is number => typeof v === "number");
    out.push({
      baseName: stem(rep.name),
      brand: rep.brand,
      family: rep.family,
      familyEmoji: rep.familyEmoji,
      category: rep.category,
      subcategory: rep.subcategory,
      purchaseMin: purchases.length ? Math.min(...purchases) : null,
      purchaseMax: purchases.length ? Math.max(...purchases) : null,
      sellMin: sells.length ? Math.min(...sells) : null,
      sellMax: sells.length ? Math.max(...sells) : null,
      marginAvg: margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null,
      status: rep.status,
      variantCount: list.length,
      variants: Array.from(new Set(variants)),
      representative: rep,
      skus: list.map((p) => p.sku),
    });
  }
  out.sort((a, b) => a.family.localeCompare(b.family) || a.category.localeCompare(b.category) || a.baseName.localeCompare(b.baseName));
  cachedCatalogus = out;
  return out;
}

// Aggregates for the dashboard
export type Stats = {
  totalSkus: number;
  uniqueProducts: number;
  families: number;
  categories: number;
  brands: number;
  active: number;
  onShop: number; // SKUs that match an entry in the live shop catalog
  perFamily: { family: Product["family"]; emoji: string; unique: number; total: number; categories: number; brands: number; topBrand: string; onShop: number }[];
  topCategories: { category: string; family: Product["family"]; emoji: string; unique: number; total: number }[];
};

let cachedStats: Stats | null = null;

export function buildStats(): Stats {
  if (cachedStats) return cachedStats;
  const cat = buildCatalogus();
  const families = new Set(PRODUCTS.map((p) => p.family));
  const categories = new Set(PRODUCTS.map((p) => p.category).filter(Boolean));
  const brands = new Set(PRODUCTS.map((p) => p.brand).filter(Boolean));
  const active = PRODUCTS.filter((p) => p.status?.toLowerCase().startsWith("actief")).length;

  const perFamily: Stats["perFamily"] = [];
  for (const family of Array.from(families)) {
    const list = PRODUCTS.filter((p) => p.family === family);
    const uniq = cat.filter((c) => c.family === family).length;
    const cats = new Set(list.map((p) => p.category).filter(Boolean));
    const brs = new Set(list.map((p) => p.brand).filter(Boolean));
    const brandCounts = new Map<string, number>();
    for (const p of list) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
    const topBrand = [...brandCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const onShopCount = list.filter((p) => SITE_BY_SKU.has(p.sku)).length;
    perFamily.push({
      family,
      emoji: list[0]?.familyEmoji ?? "📦",
      unique: uniq,
      total: list.length,
      categories: cats.size,
      brands: brs.size,
      topBrand,
      onShop: onShopCount,
    });
  }
  perFamily.sort((a, b) => b.total - a.total);

  // Top 15 categories
  const catMap = new Map<string, { total: number; family: Product["family"]; emoji: string; unique: number }>();
  for (const p of PRODUCTS) {
    if (!p.category) continue;
    const k = p.category;
    const cur = catMap.get(k);
    if (cur) cur.total++;
    else catMap.set(k, { total: 1, family: p.family, emoji: p.familyEmoji, unique: 0 });
  }
  for (const c of cat) {
    const cur = catMap.get(c.category);
    if (cur) cur.unique++;
  }
  const topCategories = [...catMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  const onShop = PRODUCTS.filter((p) => SITE_BY_SKU.has(p.sku)).length;

  cachedStats = {
    totalSkus: PRODUCTS.length,
    uniqueProducts: cat.length,
    families: families.size,
    categories: categories.size,
    brands: brands.size,
    active,
    onShop,
    perFamily,
    topCategories,
  };
  return cachedStats;
}
