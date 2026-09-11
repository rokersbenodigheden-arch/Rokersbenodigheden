# Live product export — rokersbenodigdheden.com

Snapshot of what is **actually live** in the Shopify shop, for the store rebuild.

| file | what |
|---|---|
| `rokers-live-products.json` | 277 active products, full fields |
| `rokers-live-products.csv` | same, semicolon-delimited, UTF-8 BOM (opens clean in Excel) |

Fields per product: `sku`, `title`, `handle`, `url`, `vendor`, `product_type`,
`price_incl_btw`, `compare_at`, `unit` (Set van 4 / 1 stuk), `inventory`,
`product_id`, `variant_id`, `image`, `tags`, `collections`.

## Read this before building the navigation

**170 products are deliberately set to `draft`** because of the Shopify Payments
review (ticket 00b7466a). Do not publish, restore or hardcode any of them. They
come back only once a second payment provider is live.

That withdrawal changed the shape of the catalogue. Active counts now:

```
179  Zippo aanstekers      <- 65% of the shop
 70  Kokers & etuis
 35  Asbakken
 26  Sigaren
 17  Sale
 13  Rokersbenodigdheden
  3  Pijpaccessoires
```

**Eight collections are now empty.** They must not appear in the nav or they
render dead pages:

`clipper-regulier` · `jetflame-aanstekers` · `piezo-aanstekers` ·
`wegwerp-aanstekers` · `merk-clipper` · `vloei` · `tabaksgrinders` · `pijp-bestek`

Three more have a single product: `stormaanstekers`, `aanstekergas-vuurstenen`,
`zippo-accessoires`.

**Hide empty categories dynamically, do not delete them from the structure.**
When the drafts are restored, Jetflame, Clipper, Wegwerp, Vloei, Grinders and
Pijpbestek all repopulate — a nav built on "hide if zero" survives that without
rework, a hardcoded one does not.

## Compliance constraints for the rebuild

These words must not appear anywhere in the storefront, in any language —
nav labels, section presets, hardcoded copy, image `alt`, `locales/*.json`,
and the SEO metafields (`global.title_tag` / `global.description_tag`):

> cannabis · wiet · weed · 420 · sativa · marihuana · hasj · hennep · bong · blunt

The SEO metafields are a separate layer from the product description and were
missed once already. They render as the browser tab title and the Google
snippet.

Nine product URLs and seven grinder URLs were changed, each with a 301 redirect.
Do not break those redirects.

## Regenerating

The export comes from the Shopify Admin API (products + collection membership).
Ask the Mac session to refresh it when prices or stock change — it is a
snapshot, not a live feed.
