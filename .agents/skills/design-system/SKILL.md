---
name: design-system
description: How UI is built in the Noesis SPA (server/frontend) — Mantine first, every Mantine primitive wrapped in src/shared/design-system, new code organised by domain (DDD) and named in its language, a design proposed and approved before anything new is built, then /design-sync. Use whenever a frontend task adds or changes something visible — a view, a panel, a card, a form, a new control, a layout — or reaches for raw HTML, custom CSS or a Mantine component that has no wrapper yet, even if the user never says "design system".
---

# Design system

The Noesis UI is Mantine, seen through one door: `src/shared/design-system/`.
That folder is also what claude.ai/design builds with — `.design-sync/` packages
it and `/design-sync` uploads it — so a component that skips it is one
the design tool cannot see, and a design made there cannot be built.

Paths below are relative to `server/frontend`. The `frontend` skill still
applies (accessibility, headings, how to check markup); this one is about
_what the UI is made of_.

## The rules

1. **Mantine first.** Build from Mantine components styled with theme props,
   not raw HTML, hex colours or hand-rolled controls.
2. **Wrap every Mantine primitive** in `src/shared/design-system/`, one module
   per component; only that folder imports `@mantine/*`.
3. **Shape new code by the domain (DDD)** — a feature folder per domain, names
   from the ubiquitous language, domain rules in `<domain>.model.ts`.
4. **Propose a design before building anything new**, and build only what the
   user approved.
5. **Sync** the design system once the change is approved and green.

Read the reference for the rule you are applying:

| Reference                                                          | Read it when                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------- |
| [`references/mantine-wrappers.md`](references/mantine-wrappers.md) | picking components, styling, or adding/changing a wrapper |
| [`references/domain-design.md`](references/domain-design.md)       | creating any new file, component, prop or model code      |
| [`references/design-proposal.md`](references/design-proposal.md)   | the task adds or visibly changes anything                 |

## Workflow

1. Decide whether the task is new (`design-proposal.md` defines it). If it is,
   propose the design and wait for approval.
2. Implement it — wrappers first, then the composition in its domain folder.
   Each new design-system module gets a preview in `.design-sync/previews/`.
3. Check as the `frontend` skill says — render-to-markup test, `bun run ci`.
4. Run `/design-sync` so the design tool sees the new or changed components.
   A change that touched no file in `design-system/` has nothing to sync — say
   so instead of running it.
