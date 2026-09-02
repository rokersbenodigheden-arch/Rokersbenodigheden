import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { BTW, fetchLivePrices, shopifyConfigured, updateVariantPrice } from "@/lib/shopify";
import feed from "@/data/products.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeedRow = { sku: string; purchase: number | null; sell: number | null; brand: string; category: string };
const COST = new Map<string, FeedRow>();
for (const p of feed as unknown as FeedRow[]) {
  if (p.sku) COST.set(String(p.sku), p);
}

/** Live prices from Shopify, joined with cost from the Bookwill feed. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!shopifyConfigured()) {
    return NextResponse.json(
      { error: "Shopify credentials are not configured on the server" },
      { status: 503 }
    );
  }
  try {
    const live = await fetchLivePrices();
    const rows = live.map((r) => {
      const f = COST.get(r.sku);
      const buyUnit = f?.purchase ?? null;
      const buy = buyUnit === null ? null : buyUnit * r.unitQty;
      const excl = r.price / BTW;
      const profit = buy === null ? null : excl - buy;
      return {
        ...r,
        brand: r.vendor || f?.brand || "",
        category: f?.category ?? "",
        advice: f?.sell ?? null,
        buyUnit,
        buy,
        excl,
        profit,
        margin: profit !== null && excl ? profit / excl : null,
      };
    });
    return NextResponse.json({ rows, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** Change one product's selling price (incl. BTW). */
export async function PATCH(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let variantId: number, price: number;
  try {
    ({ variantId, price } = (await req.json()) as { variantId: number; price: number });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!variantId || !Number.isFinite(price)) {
    return NextResponse.json({ error: "variantId and price are required" }, { status: 400 });
  }
  // Guard rails: a stray keystroke shouldn't be able to publish €0 or €99.999.
  if (price <= 0 || price > 5000) {
    return NextResponse.json(
      { error: "Prijs moet tussen € 0,01 en € 5.000 liggen" },
      { status: 400 }
    );
  }
  try {
    const saved = await updateVariantPrice(variantId, price);
    return NextResponse.json({ variantId, price: saved });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
