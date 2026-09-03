import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import {
  BTW,
  CATEGORY_TREE,
  fetchCollectionMembership,
  fetchLivePrices,
  shopifyConfigured,
  updateInventory,
  updateVariantPrice,
} from "@/lib/shopify";
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
    const [live, membership] = await Promise.all([fetchLivePrices(), fetchCollectionMembership()]);
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
        collections: membership[r.productId] ?? [],
      };
    });
    return NextResponse.json({
      rows,
      tree: CATEGORY_TREE,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** Change one product's selling price (incl. BTW) or its stock level. */
export async function PATCH(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { variantId?: number; price?: number; inventoryItemId?: number; stock?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // ── Stock ──────────────────────────────────────────────────────────
  if (body.stock !== undefined) {
    const { inventoryItemId, stock } = body;
    if (!inventoryItemId) {
      return NextResponse.json({ error: "inventoryItemId is required" }, { status: 400 });
    }
    if (!Number.isInteger(stock) || stock < 0 || stock > 100000) {
      return NextResponse.json(
        { error: "Voorraad moet een heel getal tussen 0 en 100.000 zijn" },
        { status: 400 }
      );
    }
    try {
      const saved = await updateInventory(inventoryItemId, stock);
      return NextResponse.json({ inventoryItemId, stock: saved });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  // ── Price ──────────────────────────────────────────────────────────
  const { variantId, price } = body;
  if (!variantId || !Number.isFinite(price)) {
    return NextResponse.json({ error: "variantId and price are required" }, { status: 400 });
  }
  // Guard rails: a stray keystroke shouldn't be able to publish EUR 0 or 99.999.
  if (price! <= 0 || price! > 5000) {
    return NextResponse.json(
      { error: "Prijs moet tussen \u20ac 0,01 en \u20ac 5.000 liggen" },
      { status: 400 }
    );
  }
  try {
    const saved = await updateVariantPrice(variantId, price!);
    return NextResponse.json({ variantId, price: saved });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
