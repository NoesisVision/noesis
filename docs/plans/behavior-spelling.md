# Rename "behaviour" to "behavior"

Status: done (October 2026).

The repository spelled the element "behaviour" in prose and in most
identifiers, while its ids (`behavior|a.b.C.do`), the id types
(`BehaviorId`) and the .NET annotation (`DomainBehaviorAttribute`) already
used American English. This change made American English the only spelling,
everywhere in the repository, including stored data and the agent-facing
contracts. This document is the one place that still spells the old form,
to say what was renamed.

## 1. What changed

About 1,800 occurrences in 178 files, outside `node_modules`, `dist` and
build output:

| What                                   | Where                                                                                                                                                                                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored JSON key `behaviours`           | system model files `graph/system-models/*.json` and design doc files `graph/changes/<change>/*.design-doc.json` in the committed `examples/*/.noesis` stores; JSON fixtures in `server/backend/test` and `server/frontend/test`                                            |
| Agent-facing contract                  | MCP tool `scan_system_model` result field; the `create-design-doc` skill text naming the design doc collection; the plugin test listing the collections                                                                                                                    |
| Zod schemas and types                  | `ScannedBehavior`, `BehaviorType`, the `behaviors` array in `app/system-model/system-model.ts`; `ELEMENT_COLLECTIONS` in `app/design-docs/design-doc.ts`; frontend `ElementKind`, `OutlineKind`, `element-ref.ts` collections                                              |
| Code identifiers                       | about 140 distinct names: `behaviorIdAt`, `isBehavior`, `asBehavior`, `BehaviorsSection`, `BehaviorInput`, `behaviorOfMethod`, the `'behavior'` role in the vocabularies, the `{behaviors}` placeholder in `server-scan-log.ts`, …                                         |
| File and directory names               | `ui/element-details/body/behavior-sections.tsx`, `sections/behaviors-section.tsx`, `sections/behaviors-section.module.css`; .NET fixture `Projection/Behaviors/BehaviorForms.cs`; `docs/plans/behavior-kinds-and-messages.md`                                              |
| .NET fixture namespace and golden file | `CSharpSyntax.Projection.Behaviors` and its symbol ids in `golden/CSharpSyntax.code-model.json`, regenerated with `NOESIS_UPDATE_GOLDEN=1 dotnet test --filter GoldenModelTests`; the expectations in `server/backend/test` follow                                         |
| Prose                                  | `docs`, `AGENT.md`, `.agents/skills`, `plugins/claude-code/skills`, Java annotation Javadoc in `code-parsers/java/annotations`, comments and doc strings in both servers, `.design-sync` preview copy and notes, `examples/qdoc-java` requirement texts; "behavioural" too |

Already American and untouched: `BehaviorId` and the `behavior|` id prefix
in both `element-id.ts` files, `DomainBehaviorAttribute`.

## 2. Decisions

1. **The stored key is `behaviors`, with no upgrade path.** The only stored
   data is the examples in this repository; they were rewritten in the same
   change. No code reads or converts the old key.
2. **Agent contracts changed together with the server**, so no plugin
   version names a key the server does not know.
3. **The golden file was regenerated, not edited.** The shorter namespace
   moves end columns on the fixture's lines, which a text replacement would
   have missed.
4. **One scripted pass**, case preserving (`Behaviour`, `behaviour`,
   `BEHAVIOUR`), over every file that contained the word, after the file and
   directory moves; then the touched files were formatted.

## 3. Verification

All of these hold after the change:

```sh
grep -rIli behaviour . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=bin --exclude-dir=obj --exclude-dir=target
# prints only docs/plans/behavior-spelling.md
bun run check-types
bun run lint
bun run test                 # backend 599, frontend 576, plugin 14
bun run test:e2e:toolchain   # both parsers against their committed code models
cd code-parsers/dotnet && dotnet test   # 248, including the golden comparison
bun run format:check on the touched files
```
