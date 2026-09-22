# Step 4 rerun with Opus (2026-09-17), branch impl-opus, same prompt as Sonnet

- Wall time 13:48:54 -> 13:52:53 (~4 min, Sonnet ~8 min). Subagent reported ~9 turns (Sonnet ~20).
- `./gradlew build` exit 0, 19 tests (Sonnet 14), adapter suite 2.15 s (Sonnet ~5 s).
- after-scan byte-identical to Sonnet's; compare_implementation_to_design: Ok, [] on first run for both.
- Deviations Opus chose on its own, all sound: @Builder.Default Option.none() on Conditions.weather; InterruptedException restores interrupt flag; trailing slash in baseUrl normalised; URI built once in ctor; covariant `PercentageDiscount getDiscount()`; Lombok @NoArgsConstructor/@AllArgsConstructor on DiscountAmount; javadoc on new types; extra tests (exact URL requested, missing field, unreachable host, provider called exactly once).

## /code-review high on Opus's tree (Fable, ~3 min, 10 findings)
Also present in Sonnet's code (the reviewer of Sonnet's tree did not raise them):
- HttpRequest.timeout bounds headers only; a stalled body blocks send() forever -> real hang path. Both.
- Blocking HTTPS round trip on every calculate(); no memoisation. Both (spec put caching out of scope).
- Silent catch-all, no logging, redundant inner try/catch. Both.
- HttpClient built per instance and never closed (AutoCloseable since 21). Both.
- PercentageDiscount accepts any int (no 0<p<=100 check). Both.
Seam issues neither model fixed (pre-existing, made reachable by the change):
- FixedDiscount still records DiscountAmount(null) vs PercentageDiscount DiscountAmount(this) -> NPE in ExclusiveOfferLevelDiscount for VIP+rain.
- ExclusiveOfferLevelDiscount isInstance inverted (always false).
Opus-specific:
- Test hygiene: StringBuilder written from server thread without sync; slow handler sleeps 6 s past server.stop.
- @Builder.Default still allows explicit .weather(null) (nit; Sonnet had the worse variant: null by default).
Environment: .gitignore lacks Eclipse/bin entries.

## Sonnet vs Opus, same prompt, same doc
| | Sonnet | Opus |
|---|---|---|
| time / turns | ~8 min / ~20 | ~4 min / ~9 |
| tests | 14 | 19 |
| scanner/comparator | Ok, identical | Ok, identical |
| defects introduced by the model itself | Conditions null default (latent NPE), swallowed interrupt, 5 s test sleep, trailing-slash URL, double catch | test data race, 6 s daemon sleep in test |
| seam defects left in place | DiscountAmount(null) mismatch, inverted isInstance | same two |
| defects shared by both (adapter design) | body-read hang, per-call HTTP, no logging, unclosed HttpClient, unvalidated percentage | same |

Reading: the structural gate (scan + compare) is blind to every item above; both trees pass it identically. Opus removed the "own goals" class of defects (null default, interrupt, URL, test duration) without being told, but neither model looked across the seam into pre-existing code it was told exclusivity depends on, and neither questioned the adapter design the doc prescribed (sync call, swallow everything). Thesis "automatic validation lets me use weaker models": holds for naming/structure conformance only; for correctness the gap between Sonnet and Opus is real but both need either a code review pass or a skill that forces (a) a seam check of touched pre-existing classes and (b) an adapter checklist (timeouts incl. body, logging, client lifecycle, input validation).
