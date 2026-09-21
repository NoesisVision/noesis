---
name: commit-message
description: >
  Generate a commit message following Conventional Commits v1.0.0 for the
  currently staged (or specified) changes. Use when the user asks to write,
  generate, or improve a commit message, or to commit with a proper message.
  Restricted to four types: feat, fix, improvement, chore.
---

# Commit Message (Conventional Commits v1.0.0)

Generate a commit message for the changes at hand. Inspect the actual diff
(`git diff --staged`, or `git diff` / the described change if nothing is staged)
before writing — the message must describe what the change does, not what the
user said about it.

## Structure

```
<type>[optional scope][!]: <description>
```

The message is this single subject line — never add a body or footers.

## Allowed types

Only these four types are permitted — never use `docs`, `refactor`, `style`,
`test`, `perf`, `build`, `ci`, or any other type:

| Type          | Use when the commit...                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `feat`        | adds a new feature to the application or library                                                                                   |
| `fix`         | patches a bug                                                                                                                      |
| `improvement` | makes something better once, without adding a feature or fixing a bug — code quality, performance, docs, tooling, the dev pipeline |
| `chore`       | is recurring maintenance that will happen again — dependency updates, lockfile refreshes, routine housekeeping                     |

## Rules (per the v1.0.0 specification)

1. The message MUST be prefixed with a type from the table above, followed by
   an OPTIONAL scope, OPTIONAL `!`, and REQUIRED terminal colon and space.
2. A scope, when used, MUST be a noun describing a section of the codebase,
   in parentheses: `fix(parser): ...`. Use scopes already present in
   `git log --oneline -20` when one fits; omit the scope if none is natural.
3. The description MUST immediately follow the colon and space: a short,
   imperative-mood summary of the change (e.g. "add", not "added"/"adds").
   No trailing period. Keep the whole subject line ≤ 72 characters.
4. Breaking changes MUST be indicated by `!` before the colon
   (`feat(api)!: ...`). Do not use a `BREAKING CHANGE:` footer — the
   description itself must say what breaks.
5. Type, scope, and description are not case-sensitive per spec, but write
   them lowercase for consistency.

## Choosing the type

- Behavior visible to users/consumers is new → `feat`.
- Behavior was wrong and is now correct → `fix`.
- One-time betterment — behavior unchanged but code, performance, docs, or
  the dev pipeline is durably better → `improvement`.
- Recurring upkeep that will happen again — dep bumps, lockfile refreshes,
  routine maintenance → `chore`.
- The improvement/chore discriminator is cadence, not surface: a one-time CI
  upgrade is an `improvement`; the dependency bumps it produces forever
  after are `chore`s.
- One commit, one type: if the diff mixes concerns, pick the type of the
  dominant change — or suggest splitting the commit.

## Examples

```
feat(frontend): add greeting route with TanStack Query
```

```
fix: include locale in greeting query key to stop stale cache reads
```

```
improvement(server): replace linear route lookup with a radix tree
```

```
chore: update GitHub Actions to v4
```

```
feat(api)!: return greeting as structured object instead of string
```

## Output

Present the complete commit message in a fenced code block. Only run
`git commit` if the user asked to commit; otherwise just provide the message.
