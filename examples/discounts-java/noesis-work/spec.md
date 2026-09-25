# Weather-based discount

## Goal

Grant a 10% offer-level discount when it is currently raining or snowing in Warsaw, Poland
(precipitation > 0 mm), using the Open-Meteo current-weather API. This is the first of a family of
weather-based discounts (temperature, wind speed, cloud cover, humidity, UV index); the design must make
adding the next ones a matter of one new field, one new query parameter and one new potential-discount class.

## Scope

In scope:
- Reading current weather for a fixed location (Warsaw: latitude 52.2297, longitude 21.0122) from
  `https://api.open-meteo.com/v1/forecast?latitude=52.2297&longitude=21.0122&current=precipitation`.
- A percentage discount applied at offer level.
- A potential discount that becomes applicable when precipitation > 0.
- Feeding weather into the existing `Conditions` so `DiscountConfig` can filter potential discounts as it does today.
- Graceful degradation: any failure of the weather API means "weather unknown", never an exception out of
  `DiscountCalculation.calculate`.
- Unit tests for the domain pieces and an integration test for the HTTP adapter against a local stub server.

Out of scope:
- Prices / actual money math. `DiscountAmount` stays a marker holding the applied `Discount`.
- Other weather discounts (only the extension points are prepared).
- Caching of weather responses, retries, configuration of the location.

## Affected bounded context and modules

Bounded context: `discounts`.

- `weather` — **new** module. Weather value object and the port for reading it.
- `weather.openmeteo` — **new** nested module. Open-Meteo HTTP adapter.
- `calculation` — **modified**. New discount classes, extended conditions, factory wiring.

Existing modules `users` and `offers` are untouched.

## Building blocks

### Module `weather` (new)

- `Weather` — value object. Current weather snapshot. Field: `precipitation` (double, mm). Future
  parameters are added as further fields here.
- `WeatherProvider` — external integration, **port** (interface). Behaviour `getCurrent()` returning
  `Option<Weather>`; `none` means weather is unknown.

### Module `weather.openmeteo` (new)

- `OpenMeteoWeatherProvider` — external integration, **adapter** implementing `WeatherProvider`.
  Behaviour `getCurrent()`. Calls Open-Meteo with `java.net.http.HttpClient`, parses the JSON with Jackson,
  maps `current.precipitation` to `Weather`. Warsaw coordinates and the list of requested `current`
  parameters are adapter configuration constants. Any network error, timeout, non-2xx status or
  unparsable body yields `Option.none()`.

### Module `calculation` (modified)

- `PercentageDiscount` — **new** domain service, implements `Discount`. Behaviour `apply(DiscountedOffer)`:
  appends a `DiscountAmount` to the offer-level discounts, exactly like `FixedDiscount`. Holds the
  percentage value.
- `PotentialPrecipitationDiscount` — **new** domain service, implements `PotentialDiscount`. Behaviours
  `isApplicableFor(Conditions)` (true when weather is known and precipitation > 0) and `getDiscount()`
  (returns the configured `PercentageDiscount`).
- `Conditions` — **modified** value object. New field `weather: Option<Weather>`. No new methods.
- `DiscountPolicyFactory` — **modified** factory. Takes a `WeatherProvider` in addition to the existing
  providers; `get(UserId)` also reads current weather and puts it into `Conditions`. No new methods.
- `DiscountsConfigProvider` — **modified** repository. Registers
  `PotentialPrecipitationDiscount(new PercentageDiscount(10))` next to the VIP discount. No new methods.

Composition root (`App.main`) wires `OpenMeteoWeatherProvider` into `DiscountPolicyFactory`.

## Rules

1. Precipitation greater than 0 mm grants a 10% discount on the whole offer.
2. Unknown weather (provider returned `none`) grants no weather discount and never interrupts calculation.
3. Weather discounts stack with other discounts; no exclusivity beyond the existing `ExclusiveOfferLevelDiscount` mechanism.
4. Weather is read once per `DiscountPolicyFactory.get` call.

## Acceptance scenarios

1. Precipitation 0.5 mm, non-VIP user → offer carries one `DiscountAmount` from `PercentageDiscount(10)`.
2. Precipitation 0 mm → no weather discount.
3. Weather API returns HTTP 500, times out, or returns malformed JSON → `getCurrent` is `none`, offer is calculated with no weather discount, no exception.
4. VIP user during rain → both the VIP fixed discount and the precipitation discount are applied.
5. Adapter integration test: local HTTP stub returning `{"current":{"precipitation":0.5}}` → `Weather(0.5)`.

## Extension recipe for the next weather discount

1. Add a field to `Weather` (e.g. `temperature`).
2. Add the parameter to the adapter's `current=` list and map it.
3. Add `PotentialTemperatureDiscount` implementing `PotentialDiscount` and register it in `DiscountsConfigProvider`.
