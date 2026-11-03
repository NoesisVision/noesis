# Java library fixture

A small annotated Maven build over a library no scan parses, for the Java
parser's end-to-end test (`test/e2e-toolchain/java-parser.e2e.spec.ts`).
`../shared-kernel` is that library: unannotated, with the value object
`Money` and the domain service interface `ExchangeRates`. The test installs it
into the local Maven repository before scanning, as a team would publish it.

Billing reaches the library only as stubs in the code model. The library
manifest `.noesis/libraries/shared-kernel.json` lists both types, so they
become blocks of the model (R14 of `docs/plans/code-model-to-system-model.md`)
and every use of them in billing points at those blocks: `FixedExchangeRates`
implements `ExchangeRates` (`extends`), `InvoicePricing` holds it (a
collaborator), `Invoice` holds a `Money` behind its getter (state), and the
behaviors take and give both.
