# @repo/shared-contracts

The knowledge graph **file contracts**: every shape a file under `.noesis/`
can have, plus the payloads the import tools take. Defined once here as
[zod](https://zod.dev/) schemas with inferred TS types, consumed as
TypeScript source by two readers (decision D4):

- **the agent**, through the copy `plugins/claude-code/contracts/` — a build
  output of the plugin (`bun run build`, run as `prepack`), stamped with the
  plugin version and asserted byte-identical by the plugin's tests
  (decision D4). Skills name the contract they need by a path under that
  directory and read the `.ts` file directly.
- **the service**, which imports this package and validates with the same
  schemas twice: in the `validate` tool against the agent's working file, and
  again at the write boundary. `bun build` inlines them into the service
  bundle, so the service package ships no readable copy (decision D4).

The schemas are **declarative on purpose**: object shapes, enums, defaults
and `.describe()` text; no refinements, no transforms, no imports beyond zod
and sibling contract files. That is what keeps the source readable as
reference material. Whole-document rules a schema cannot express live in the
service (`server/backend/src/mcp/contracts`), and conventions with no type
live in a companion `.md` beside each family.

## Families

| Files                                                                                     | Companion                                    | What they shape                                                                                 |
| ----------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `locked.ts`                                                                               | `conventions.md`                             | Rules every file follows: where files live, keys and ids, references, locked fields             |
| `change.ts`                                                                               | `change.md`                                  | `graph/changes/<change>/data.json` — the unit of work imports and design docs belong to         |
| `information-sources/conversation.ts`, `document.ts`, `*-analysis.ts`, `information-*.ts` | `information-sources/information-sources.md` | Imported conversations and documents, their fragments and categories, and the import payloads   |
| `topic.ts`, `decision.ts`                                                                 | `wiki.md`                                    | `graph/wiki/topics/`, `graph/wiki/decisions/` — the curated distillate, with `*_locked` markers |
| `design-doc.ts`, `design-doc-ref.ts`                                                      | `design-doc.md`                              | `graph/changes/<change>/design-docs/` — the normalised design-doc model (decision D4), its refs |
| `system-model.ts`                                                                         | `system-model.md`                            | `graph/system-model/` — the implemented model the scanner writes                                |

`index.ts` re-exports every schema; `src/*.ts` is also importable by path.
The `validate` tool's contract names (`change`, `conversation`, `document`,
`conversation-analysis`, `document-analysis`, `topic`, `decision`,
`system-model`, `design-document`) are the keys of the service's registry in
`server/backend/src/mcp/contracts/registry.ts`, which maps each to a schema
here.

## Changing a contract

1. Edit the schema: describe every field, keep it declarative, and update
   the family's companion `.md` for anything the shape cannot say.
2. Put any whole-document rule in the service's registry entry, so `validate`
   and the write reject the same things.
3. Nothing to regenerate or commit: the plugin copies the sources on build
   and pack, and its tests assert the copy matches. The `.spec.ts` files
   here cover the shapes themselves.

## Scripts

| Script                | What it does   |
| --------------------- | -------------- |
| `bun run test`        | `bun test src` |
| `bun run check-types` | `tsc --noEmit` |

The package is private and workspace-internal; nothing publishes it.
