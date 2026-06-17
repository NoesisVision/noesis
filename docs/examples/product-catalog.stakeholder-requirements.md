# Product Catalog — Stakeholder Requirements (Domain Stories)

Problem-space artifact for the product catalog of an e-commerce system. Need Statements
(kite altitude) + Job Stories (sea level). Solution-neutral: it names no system, screen,
or mechanism, and changes only when the understanding of the **problem** changes.

Each story has a stable slug ID in `[brackets]`, ready to be linked **up** to from a future
solution-space artifact (e.g. `product-catalog.feature`) via `@PC-*` tags — link direction
solution → problem, many-to-many. This document never references a solution.

---

## 1. One catalog, many storefronts

**Need Statement**

Commercial teams need a way to offer a single product catalog across multiple storefronts
(regions, languages, sales channels) while each storefront shows only the assortment,
pricing, and availability appropriate to it, because the same product is sold into
different markets under different commercial and legal rules — one global view would expose
products to markets where they are not sold or not permitted, while a separate catalog per
storefront would duplicate effort and drift out of sync.

**Job Stories**

- **[PC-assortment-regional-view]** When a shopper browses a regional storefront, they want
  to see only the products available in their region, so they can avoid discovering items
  they cannot buy or have shipped to them.

- **[PC-assortment-channel-curate]** When a merchandiser curates the assortment for one
  storefront, they want to include or exclude products for that storefront alone, so they
  can tailor the offer to that market without changing what other storefronts show.

- **[PC-price-storefront-scope]** When a pricing manager sets a price for a storefront, they
  want it to apply only to that storefront's market and currency, so they can price locally
  without disturbing pricing in other markets.

- **[PC-localized-content-view]** When a shopper views a product in their own language, they
  want its title, description, and imagery localized for their market, so they can
  understand and judge the product in terms familiar to them.

- **[PC-restricted-product-block]** _(integrity)_ When a shopper in a region where a product
  is restricted tries to open or order it, they want the storefront to refuse and explain
  that it is unavailable in their region, so they can avoid attempting a purchase that
  cannot be fulfilled or is not permitted.

_Coverage rows: read (regional view, localized content), write/curate (channel assortment,
storefront price), integrity (restricted-product refusal). Lifecycle of the catalog
structure itself is owned by section 3._

---

## 2. Describing products so they can be found and compared

**Need Statement**

Product data stewards need a way to describe each product with the characteristics specific
to its kind, because different product types carry fundamentally different characteristics
— a garment has size and colour, a laptop has memory and processor — and a single flat set
of fields either omits what shoppers need in order to choose or clutters every product with
characteristics that do not apply to it.

**Job Stories**

- **[PC-typed-attributes-author]** When a product data steward adds a product of a given
  type, they want to capture only the characteristics that apply to that type, so they can
  describe it completely without wading through fields irrelevant to it.

- **[PC-faceted-browse]** When a shopper narrows a category by characteristics such as size,
  colour, or brand, they want to see only the products matching those characteristics, so
  they can find what fits their need without scanning the entire category.

- **[PC-compare-products]** When a shopper compares several products of the same type, they
  want them set side by side on the same characteristics, so they can judge the differences
  that actually matter for that kind of product.

- **[PC-incomplete-product-block]** _(integrity)_ When a product data steward tries to
  publish a product missing the characteristics required for its type, they want the system
  to refuse and name what is missing, so they can avoid putting an unsearchable or
  misleading product in front of shoppers.

_Coverage rows: write/author (typed attributes), read (faceted browse, compare), integrity
(incomplete-product refusal). No storefront-scoping stories here — that tension is owned by
section 1._

---

## 3. Evolving the catalog structure over time

**Need Statement**

Merchandising teams need a way to evolve the catalog's categories, attributes, and product
types over time, because the assortment, the seasons, and the way shoppers look for things
change continually, and a structure fixed at launch would force every new category or
characteristic to wait on a re-platforming effort.

**Job Stories**

- **[PC-new-category]** _(lifecycle)_ When the business introduces a new product line, a
  merchandiser wants to add a category for it and place products into it, so they can make
  the line shoppable without engineering work.

- **[PC-new-attribute]** _(lifecycle)_ When a product type gains a characteristic shoppers
  now care about (for example, water resistance), a product data steward wants to add it as
  a characteristic of that type, so they can capture and expose it from then on.

- **[PC-recategorize]** _(lifecycle)_ When a merchandiser reorganizes the taxonomy for a new
  season, they want to move products and categories into the new structure, so they can
  match how shoppers currently browse without losing existing product information.

- **[PC-category-safe-removal]** _(integrity)_ When a merchandiser tries to remove a category
  that still contains products or is still referenced elsewhere in the catalog structure,
  they want the system to refuse and identify what still depends on it, so they can resolve
  the dependency intentionally rather than leave products unreachable.

- **[PC-attribute-safe-retire]** _(integrity)_ When a product data steward retires a
  characteristic, they want the system to allow it only when no product type still requires
  it, so they can keep the set of characteristics clean without breaking existing products.

_Coverage rows: lifecycle (new category, new attribute, recategorize), integrity (two safe
-removal stories). Read and curate of the resulting structure are owned by sections 1–2._

---

_All stories carry stable `PC-_` IDs and are ready for a solution-space artifact to link up
to. Until one exists, every story is **unspecified** — expected at discovery stage, and the
point at which a coverage check would flag them for build.\*
