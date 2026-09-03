import "server-only";

/**
 * Server-side Shopify Admin API access.
 *
 * The credentials live in Vercel environment variables and are never sent to
 * the browser. The client_credentials grant returns a token that expires after
 * ~24h, so we mint one on demand and keep it in memory until shortly before it
 * lapses.
 */

const SHOP = process.env.SHOPIFY_SHOP ?? "fnt7n4-xt.myshopify.com";
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const API = "2024-10";

export const BTW = 1.21; // shop prices include 21% VAT

let cached: { token: string; expiresAt: number } | null = null;

export function shopifyConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

async function getToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET are not set");
  }
  const res = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`token request failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh a few minutes early so a long request can't run past expiry.
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 };
  return cached.token;
}

async function admin(path: string, init?: RequestInit) {
  const token = await getToken();
  return fetch(`https://${SHOP}/admin/api/${API}/${path}`, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export type LivePrice = {
  productId: number;
  variantId: number;
  inventoryItemId: number | null;
  sku: string;
  title: string;
  vendor: string;
  /** what the customer pays, incl. BTW */
  price: number;
  compareAt: number | null;
  /** 4 for a "Set van 4", else 1 */
  unitQty: number;
  unitLabel: string;
  inventory: number | null;
};

/** Every product with its first variant — that's how this catalog is built. */
export async function fetchLivePrices(): Promise<LivePrice[]> {
  const fields = "id,title,vendor,variants";
  const out: LivePrice[] = [];
  let path: string | null = `products.json?limit=250&fields=${fields}`;

  while (path) {
    const res: Response = await admin(path);
    if (!res.ok) throw new Error(`products fetch failed (${res.status})`);
    const body = (await res.json()) as { products: ShopifyProduct[] };

    for (const p of body.products) {
      const v = p.variants?.[0];
      if (!v) continue;
      const isSet = p.title.includes("Set van 4");
      out.push({
        productId: p.id,
        variantId: v.id,
        inventoryItemId: v.inventory_item_id ?? null,
        sku: (v.sku ?? "").trim(),
        title: p.title,
        vendor: p.vendor,
        price: Number(v.price),
        compareAt: v.compare_at_price ? Number(v.compare_at_price) : null,
        unitQty: isSet ? 4 : 1,
        unitLabel: isSet ? "Set van 4" : "1 stuk",
        inventory: v.inventory_quantity ?? null,
      });
    }

    // Shopify paginates via the Link header.
    const link = res.headers.get("link") ?? "";
    const next = link.split(",").find((p) => p.includes('rel="next"'));
    const m = next?.match(/page_info=([^>&]+)/);
    path = m ? `products.json?limit=250&fields=${fields}&page_info=${m[1]}` : null;
  }
  return out;
}

type ShopifyProduct = {
  id: number;
  title: string;
  vendor: string;
  variants?: {
    id: number;
    inventory_item_id?: number;
    sku?: string;
    price: string;
    compare_at_price?: string | null;
    inventory_quantity?: number;
  }[];
};

/**
 * The shop's category tree, mirroring the storefront navigation so the price
 * sheet is organised the way the site is. Each node is a real collection.
 */
export const CATEGORY_TREE: { handle: string; label: string; children: { handle: string; label: string }[] }[] = [
  {
    handle: "zippos", label: "Zippo aanstekers", children: [
      { handle: "zippo-design", label: "Design aanstekers" },
      { handle: "zippo-harley", label: "Harley-Davidson" },
      { handle: "zippo-etuis", label: "Etuis en pouches" },
      { handle: "zippo-accessoires", label: "Zippo accessoires" },
    ],
  },
  {
    handle: "clipper-regulier", label: "Overige aanstekers", children: [
      { handle: "jetflame-aanstekers", label: "Jetflame" },
      { handle: "piezo-aanstekers", label: "Piezo" },
      { handle: "stormaanstekers", label: "Storm" },
      { handle: "wegwerp-aanstekers", label: "Wegwerp" },
      { handle: "aanstekergas-vuurstenen", label: "Gas en vuurstenen" },
      { handle: "merk-clipper", label: "Clipper" },
    ],
  },
  {
    handle: "rokersbenodigdheden", label: "Rokersbenodigdheden", children: [
      { handle: "vloei", label: "Vloei" },
      { handle: "filters-tips", label: "Filters en tips" },
      { handle: "filters-houders", label: "Filters en houders" },
      { handle: "rolling-boxes", label: "Rolling boxes" },
      { handle: "sigarettenkokers", label: "Sigarettenkokers" },
      { handle: "tabaksgrinders", label: "Tabaksgrinders" },
    ],
  },
  {
    handle: "sigaren", label: "Sigaren", children: [
      { handle: "sigarenknippers", label: "Sigarenknippers" },
      { handle: "sigarenboren", label: "Sigarenboren" },
      { handle: "sigarenkokers", label: "Sigarenkokers" },
      { handle: "sigaren-asbakken", label: "Sigarenasbakken" },
      { handle: "humidors", label: "Humidors" },
    ],
  },
  { handle: "asbakken", label: "Asbakken", children: [] },
  {
    handle: "pijpen", label: "Pijpaccessoires", children: [
      { handle: "bruyere-pijpen", label: "Bruyère pijpen" },
      { handle: "pijp-bestek", label: "Pijpbestek" },
    ],
  },
  { handle: "sale", label: "Sale", children: [] },
];

const ALL_HANDLES = CATEGORY_TREE.flatMap((n) => [n.handle, ...n.children.map((c) => c.handle)]);

let membershipCache: { at: number; map: Record<number, string[]> } | null = null;
const MEMBERSHIP_TTL = 5 * 60 * 1000;

/** productId -> collection handles it belongs to (only handles in the tree). */
export async function fetchCollectionMembership(): Promise<Record<number, string[]>> {
  if (membershipCache && Date.now() - membershipCache.at < MEMBERSHIP_TTL) return membershipCache.map;

  // Resolve handles to collection ids (smart + custom).
  const ids = new Map<string, number>();
  for (const kind of ["smart_collections", "custom_collections"]) {
    const res = await admin(`${kind}.json?limit=250&fields=id,handle`);
    if (!res.ok) continue;
    const body = (await res.json()) as { [k: string]: { id: number; handle: string }[] };
    for (const c of body[kind] ?? []) if (ALL_HANDLES.includes(c.handle)) ids.set(c.handle, c.id);
  }

  const map: Record<number, string[]> = {};
  for (const [handle, id] of ids) {
    let path: string | null = `products.json?limit=250&fields=id&collection_id=${id}`;
    while (path) {
      const res: Response = await admin(path);
      if (!res.ok) break;
      const body = (await res.json()) as { products: { id: number }[] };
      for (const p of body.products) (map[p.id] ??= []).push(handle);
      const link = res.headers.get("link") ?? "";
      const next = link.split(",").find((s) => s.includes('rel="next"'));
      const m = next?.match(/page_info=([^>&]+)/);
      path = m ? `products.json?limit=250&fields=id&collection_id=${id}&page_info=${m[1]}` : null;
    }
  }
  membershipCache = { at: Date.now(), map };
  return map;
}

/** Write a new selling price (incl. BTW) to one variant. */
export async function updateVariantPrice(variantId: number, price: number) {
  if (!Number.isFinite(price) || price <= 0) throw new Error("invalid price");
  const res = await admin(`variants/${variantId}.json`, {
    method: "PUT",
    body: JSON.stringify({ variant: { id: variantId, price: price.toFixed(2) } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`price update failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { variant: { id: number; price: string } };
  return Number(body.variant.price);
}


let locationId: number | null = null;

/**
 * The app's scopes include write_inventory but NOT read_locations, so
 * /locations.json 403s. The inventory level for any item carries its
 * location_id, so read it from there instead and cache it.
 */
async function getLocationId(inventoryItemId: number): Promise<number> {
  if (locationId) return locationId;
  const res = await admin(`inventory_levels.json?inventory_item_ids=${inventoryItemId}&limit=1`);
  if (!res.ok) throw new Error(`inventory level lookup failed (${res.status})`);
  const body = (await res.json()) as { inventory_levels: { location_id: number }[] };
  const id = body.inventory_levels?.[0]?.location_id;
  if (!id) throw new Error("no inventory location for this item");
  locationId = id;
  return id;
}

/** Set the stock level for one inventory item. */
export async function updateInventory(inventoryItemId: number, available: number) {
  if (!Number.isInteger(available) || available < 0) throw new Error("invalid stock");
  const location_id = await getLocationId(inventoryItemId);
  const res = await admin("inventory_levels/set.json", {
    method: "POST",
    body: JSON.stringify({ location_id, inventory_item_id: inventoryItemId, available }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`stock update failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { inventory_level: { available: number } };
  return body.inventory_level.available;
}
