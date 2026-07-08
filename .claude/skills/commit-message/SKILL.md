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

[optional body]

[optional footer(s)]
```

## Allowed types

Only these four types are permitted — never use `docs`, `refactor`, `style`,
`test`, `perf`, `build`, `ci`, or any other type:

| Type          | Use when the commit...                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `feat`        | adds a new feature to the application or library                                                             |
| `fix`         | patches a bug                                                                                                |
| `improvement` | improves existing behavior without adding a feature or fixing a bug (refactoring, performance, code quality) |
| `chore`       | is maintenance with no production-behavior change (deps, tooling, CI, docs, config, renames)                 |

## Rules (per the v1.0.0 specification)

1. The message MUST be prefixed with a type from the table above, followed by
   an OPTIONAL scope, OPTIONAL `!`, and REQUIRED terminal colon and space.
2. A scope, when used, MUST be a noun describing a section of the codebase,
   in parentheses: `fix(parser): ...`. Use scopes already present in
   `git log --oneline -20` when one fits; omit the scope if none is natural.
3. The description MUST immediately follow the colon and space: a short,
   imperative-mood summary of the change (e.g. "add", not "added"/"adds").
   No trailing period. Keep the whole subject line ≤ 72 characters.
4. A longer body MAY follow, separated from the description by one blank
   line. It is free-form and MAY have multiple newline-separated paragraphs.
   Add a body only when the diff's _why_ or _how_ isn't obvious from the
   subject; never restate the diff.
5. Footers MAY follow one blank line after the body. Each footer is a token,
   then `: ` or ` #`, then a value (e.g. `Refs: #123`, `Reviewed-by: X`).
   Footer tokens MUST use `-` instead of spaces (`Acked-by`), except
   `BREAKING CHANGE`.
6. Breaking changes MUST be indicated by `!` before the colon
   (`feat(api)!: ...`), and/or by a `BREAKING CHANGE: <description>` footer.
   `BREAKING CHANGE` MUST be uppercase; `BREAKING-CHANGE` is synonymous.
7. Type, scope, and description are not case-sensitive per spec, but write
   them lowercase for consistency.

## Choosing the type

- Behavior visible to users/consumers is new → `feat`.
- Behavior was wrong and is now correct → `fix`.
- Behavior unchanged but code/performance is better → `improvement`.
- Everything else (deps, tooling, docs, CI, config) → `chore`.
- One commit, one type: if the diff mixes concerns, pick the type of the
  dominant change and mention the rest in the body — or suggest splitting
  the commit.

## Examples

```
feat(frontend): add greeting route with TanStack Query
```

```
fix: prevent stale cache read on concurrent greeting requests

The query key omitted the locale, so switching languages served the
previous locale's greeting until the cache expired.
```

```
improvement(server): replace linear route lookup with a radix tree
```

```
chore: update GitHub Actions to v4
```

```
feat(api)!: return greeting as structured object

BREAKING CHANGE: `GET /greeting` now returns `{ "message": string }`
instead of a plain string.
```

## Output

Present the complete commit message in a fenced code block. Only run
`git commit` if the user asked to commit; otherwise just provide the message.
