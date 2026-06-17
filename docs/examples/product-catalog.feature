# Solution-space artifact for the product catalog. EARS requirements + BDD scenarios.
# Pairs with product-catalog.stakeholder-requirements.md (problem space).
#
# Layering (see .claude/skills/system-requirements and domain-stories):
#   Feature    — a system capability (organised by capability, NOT by story)
#   Rule       — one system requirement: ID + short name on the line, the verbatim
#                EARS sentence (or 6-part QAS for NFRs) as the description block,
#                key Examples below as executable evidence.
#   @SR-* tag  — the requirement ID.
#   @PC-* tags — the Fulfills link to domain stories (many-to-many).
#   @nfr tags  — non-functional rule + its quality dimension.
#
# Named systems (assumed high-level design — adjust to your architecture):
#   catalog service    — products, product types, characteristics, categories,
#                        taxonomy, publication, integrity guards.
#   storefront service — shopper-facing resolution: per-storefront assortment,
#                        localized content, regional availability, browse, compare.
#   pricing service    — storefront / market / currency-scoped prices.
#
# Glossary (terms used with one consistent meaning):
#   storefront      — a configured sales context (region + language + channel).
#   assortment      — the set of products made available on a given storefront.
#   product type    — a kind of product (e.g. garment, laptop) defining which
#                     characteristics apply.
#   characteristic  — a typed attribute of a product type (e.g. size, memory).
#   taxonomy        — the tree of categories products are placed into.

@capability:storefront-resolution
Feature: Storefront assortment and content

  A shopper sees only the products, content, and availability appropriate to the
  storefront they are browsing.

  # ---- Functional (EARS: state-driven) --------------------------------------
  @SR-SF-001 @PC-assortment-regional-view
  Rule: SR-SF-001 A storefront shows only products available in its region

    While a shopper is browsing a storefront, the storefront service shall
    return only products whose availability includes that storefront's region.

    Scenario Outline: Region determines visible products
      Given a storefront for region "<region>"
      And product "<product>" is available in regions "<available_in>"
      When a shopper browses the storefront
      Then product "<product>" is <visible_or_not>

      Examples:
        | region | product   | available_in | visible_or_not |
        | UK     | scarf-01  | UK, IE       | visible        |
        | UK     | hat-09    | DE           | not visible    |

  # ---- Functional (EARS: event-driven) --------------------------------------
  @SR-SF-002 @PC-localized-content-view
  Rule: SR-SF-002 Product content is shown in the storefront's language

    When a shopper opens a product on a storefront, the storefront service
    shall return the product's title, description, and imagery in the
    storefront's configured language.

    Scenario: A localized product is shown in the storefront language
      Given a storefront configured for language "fr"
      And product "scarf-01" has French content
      When a shopper opens product "scarf-01"
      Then the title, description, and imagery shown are the French content

  # ---- Functional (EARS: unwanted behaviour — missing localization) ---------
  @SR-SF-003 @PC-localized-content-view
  Rule: SR-SF-003 Missing localization falls back to default content

    If no content exists in the storefront's configured language for a requested
    product, then the storefront service shall return the product's
    default-language content and mark it as not localized.

    Scenario: Falls back to default language when localization is missing
      Given a storefront configured for language "fr"
      And product "hat-09" has content only in default language "en"
      When a shopper opens product "hat-09"
      Then the English content is shown
      And the content is marked as not localized

  # ---- Functional (EARS: unwanted behaviour — integrity) --------------------
  @SR-SF-004 @PC-restricted-product-block
  Rule: SR-SF-004 Region-restricted products are refused with a reason

    If a shopper requests a product that is restricted in their storefront's
    region, then the storefront service shall refuse the request and return a
    reason indicating regional unavailability.

    Scenario: A product restricted in the region is refused
      Given a storefront for region "UK"
      And product "knife-set-3" is restricted in region "UK"
      When a shopper requests product "knife-set-3"
      Then the request is refused
      And the reason given is "unavailable in your region"


@capability:assortment-and-pricing
Feature: Managing assortment and pricing per storefront

  Commercial roles tailor which products appear and at what price on each
  storefront without affecting the others.

  # ---- Functional (EARS: event-driven) --------------------------------------
  @SR-AS-001 @PC-assortment-channel-curate
  Rule: SR-AS-001 Assortment changes are scoped to one storefront

    When a merchandiser includes or excludes a product for a named storefront,
    the catalog service shall update that product's availability for the named
    storefront without affecting its availability on any other storefront.

    Scenario: Excluding a product affects only the named storefront
      Given product "scarf-01" is available on storefronts "UK", "IE"
      When a merchandiser excludes "scarf-01" from storefront "IE"
      Then "scarf-01" is not available on storefront "IE"
      And "scarf-01" remains available on storefront "UK"

  # ---- Functional (EARS: event-driven) --------------------------------------
  @SR-PR-001 @PC-price-storefront-scope
  Rule: SR-PR-001 A price applies only to its storefront's market and currency

    When a pricing manager publishes a price for a named storefront, the pricing
    service shall make that price effective only within that storefront's market
    and currency.

    Scenario: A published price does not affect other storefronts
      Given product "scarf-01" is priced 12.00 GBP on storefront "UK"
      When a pricing manager publishes a price of 15.00 EUR for storefront "IE"
      Then the price on storefront "IE" is 15.00 EUR
      And the price on storefront "UK" remains 12.00 GBP


@capability:product-discovery
Feature: Finding and comparing products

  Shoppers narrow large categories and compare like with like.

  # ---- Functional (EARS: event-driven) --------------------------------------
  @SR-DS-001 @PC-faceted-browse
  Rule: SR-DS-001 Filtering returns only products matching every selected value

    When a shopper filters a category by one or more characteristics, the
    storefront service shall return only the products whose values match all of
    the selected characteristics.

    Scenario: Filtering by two characteristics narrows to matches only
      Given a category containing garments
      When a shopper filters by colour "blue" and size "M"
      Then every returned product is colour "blue" and size "M"
      And no product of another colour or size is returned

  # ---- Functional (EARS: event-driven) --------------------------------------
  @SR-DS-002 @PC-compare-products
  Rule: SR-DS-002 Same-type products are compared on the same characteristics

    When a shopper selects multiple products of the same product type to compare,
    the storefront service shall present them aligned on the set of
    characteristics defined for that type.

    Scenario: Comparing laptops aligns them on laptop characteristics
      Given products "lap-1" and "lap-2" are of product type "laptop"
      When a shopper compares "lap-1" and "lap-2"
      Then both are shown aligned on the "laptop" characteristics

  # ---- Non-functional (runtime-measurable: performance) ---------------------
  @nfr @performance @SR-DS-003 @PC-faceted-browse @PC-assortment-regional-view
  Rule: SR-DS-003 Filtered browse responds within 300 ms at p95 under load

    Source:           a shopper browsing a storefront
    Stimulus:         a category browse request with facet filters applied
    Artifact:         the storefront service browse endpoint
    Environment:      sustained load of 200 requests/second
    Response:         a filtered result page is returned
    Response measure: 95th-percentile latency <= 300 ms, zero errors

    Scenario: Browse latency under sustained load
      Given the storefront service under a sustained load of 200 requests per second
      When 12000 filtered browse requests are issued over 60 seconds
      Then the 95th-percentile response time is at most 300 milliseconds
      And no request returns an error


@capability:product-authoring
Feature: Authoring products with typed characteristics

  Product data stewards describe each product with only the characteristics that
  apply to its type, and incomplete products cannot reach shoppers.

  # ---- Functional (EARS: event-driven) --------------------------------------
  @SR-AU-001 @PC-typed-attributes-author
  Rule: SR-AU-001 A product accepts only its type's characteristics

    When a product data steward edits a product of a given type, the catalog
    service shall accept values only for the characteristics defined for that
    product type.

    Scenario: A characteristic from another type is rejected
      Given product "lap-1" is of product type "laptop"
      When a steward sets the "memory" characteristic on "lap-1"
      Then the value is accepted
      When a steward sets the "collar size" characteristic on "lap-1"
      Then the value is rejected as not defined for type "laptop"

  # ---- Functional (EARS: unwanted behaviour — integrity) --------------------
  @SR-AU-002 @PC-incomplete-product-block
  Rule: SR-AU-002 A product missing required characteristics cannot be published

    If a product data steward attempts to publish a product missing one or more
    characteristics marked required for its type, then the catalog service shall
    reject the publication and return the list of missing characteristics.

    Scenario: Publishing an incomplete product is refused
      Given product type "laptop" requires "memory" and "processor"
      And product "lap-3" has "memory" but not "processor"
      When a steward attempts to publish "lap-3"
      Then the publication is rejected
      And the missing characteristics returned are "processor"


@capability:catalog-structure-lifecycle
Feature: Evolving the catalog structure

  Merchandising teams add and reorganise categories, types, and characteristics
  over time, and the system protects referential integrity.

  # ---- Functional (EARS: event-driven) --------------------------------------
  @SR-LC-001 @PC-new-category
  Rule: SR-LC-001 A new category is immediately able to receive products

    When a merchandiser adds a category, the catalog service shall make the
    category able to receive products within the same administrative session.

    Scenario: A newly added category can hold products at once
      Given no category named "outerwear" exists
      When a merchandiser adds category "outerwear"
      Then a product can be placed into "outerwear" in the same session

  # ---- Functional (EARS: event-driven) --------------------------------------
  @SR-LC-002 @PC-new-attribute
  Rule: SR-LC-002 A new characteristic becomes available for its type

    When a product data steward adds a characteristic to a product type, the
    catalog service shall make that characteristic available for entry on
    products of that type from that point onward.

    Scenario: A new characteristic can be filled on existing products of the type
      Given product type "jacket" exists with products
      When a steward adds characteristic "water resistance" to type "jacket"
      Then "water resistance" can be set on any product of type "jacket"

  # ---- Functional (EARS: event-driven — data preservation) ------------------
  @SR-LC-003 @PC-recategorize
  Rule: SR-LC-003 Moving an item in the taxonomy preserves its data

    When a merchandiser moves a product or category to a different position in
    the taxonomy, the catalog service shall preserve all of the moved item's
    existing data.

    Scenario: Re-parenting a category keeps its products and characteristics
      Given category "scarves" contains 40 products under "accessories"
      When a merchandiser moves "scarves" under "winter"
      Then "scarves" contains the same 40 products with unchanged data

  # ---- Functional (EARS: unwanted behaviour — integrity) --------------------
  @SR-LC-004 @PC-category-safe-removal
  Rule: SR-LC-004 A category in use cannot be deleted

    If a merchandiser attempts to delete a category that still contains products
    or is referenced by another category, then the catalog service shall reject
    the deletion and return the count and identifiers of the dependent items.

    Scenario: Deleting a non-empty category is refused
      Given category "scarves" contains 40 products
      When a merchandiser attempts to delete "scarves"
      Then the deletion is rejected
      And the response reports 40 dependent products

  # ---- Functional (EARS: unwanted behaviour — integrity) --------------------
  @SR-LC-005 @PC-attribute-safe-retire
  Rule: SR-LC-005 A required characteristic cannot be retired

    If a product data steward attempts to retire a characteristic that is still
    marked required by at least one product type, then the catalog service shall
    reject the retirement and return the identifiers of the product types that
    still require it.

    Scenario: Retiring an in-use required characteristic is refused
      Given characteristic "memory" is required by product type "laptop"
      When a steward attempts to retire characteristic "memory"
      Then the retirement is rejected
      And the response identifies product type "laptop"

  # ---- Non-functional (runtime-measurable: extensibility) -------------------
  @nfr @extensibility @SR-LC-006 @PC-new-category @PC-new-attribute
  Rule: SR-LC-006 Catalog structure extends without deployment

    Source:           a merchandiser or data steward evolving the catalog
    Stimulus:         adding a category or a product-type characteristic
    Artifact:         the catalog service
    Environment:      the running production system
    Response:         the new category or characteristic becomes usable
    Response measure: usable within the same session, zero redeployments

    Scenario: Adding a category and a characteristic requires no deployment
      Given the running catalog service
      When a merchandiser adds category "outerwear"
      And a steward adds characteristic "water resistance" to type "jacket"
      Then both are usable in the same session
      And no service redeployment occurred
