# Code model schema

The JSON Schema (draft 2020-12) of the common code model every parser
writes: `manifest.schema.json` for `code-model/<language>/manifest.json` and
`code-model.schema.json` for each `<artifact>.code-model.json` the manifest
lists. The concepts and the id grammar are in
[`docs/arch/code-model.md`](../../docs/arch/code-model.md).

Both files are generated from the zod schema in
`server/backend/src/app/scanner/code-model/code-model.ts`, the one the service
validates with, by `bun run generate` (from the repo root, or
`server/backend`). Do not edit them by hand: change the zod schema and
regenerate. CI fails when the committed files are stale, and
`server/backend/test/unit/code-model-json-schema.spec.ts` checks the .NET and
Java parsers' golden files against them; the Java parser validates its own
output against them too (`parsers/java/core/.../SchemaValidationTest`).

Every shared shape is a named `$defs` entry (`TypeRef`, `DeclarationNode`,
`Edge`, …); objects allow no unknown property except the `languageSpecific`
bag, which takes any language-prefixed scalar fact.
