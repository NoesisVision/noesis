---
name: init-task
description: >
  Initialize a new unit of work: determine its type (feat, fix, improvement,
  chore — the commit-message vocabulary) and scope (repo, a subsystem, or a
  single package), elicit requirements through an interview, and create a task
  file in the scope's docs/work/<type>/ folder as the starting point for
  exploring solution options. Use when the user wants to start, initialize, or
  kick off a new task, feature, fix, improvement, or chore.
---

# Init Task

Turn a rough intention ("I want to work on X") into a requirements document at
the right place in the repo. The output file is the **starting point for
finding solution options** — it captures the problem space, not a solution.

## 1. Determine type and scope

**Type** is one of the four commit types (decision 42, same vocabulary as the
commit-message skill): `feat`, `fix`, `improvement`, `chore`. Infer it from the
user's description and confirm; if genuinely ambiguous, ask with
AskUserQuestion.

**Scope** names where the work lands, at one of three levels. Discover valid
scopes from the tree at invocation time — never hardcode a package list:

| Level     | Valid scopes                                                                                                                                                               | docs folder           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| repo      | the repo root (cross-cutting work)                                                                                                                                         | `docs/`               |
| subsystem | `server`, `plugins`, `packages`, `scanners`                                                                                                                                | `<subsystem>/docs/`   |
| package   | any directory under a subsystem containing a project manifest (`package.json`, `pom.xml`, `build.gradle*`) — e.g. `server/frontend`, `plugins/mcp-bridge`, `scanners/java` | `<package-dir>/docs/` |

Pick the narrowest scope that contains the work: a task touching only one
package gets that package; one spanning several packages of a subsystem gets
the subsystem; one spanning subsystems gets `repo`. If the user's description
doesn't pin it down, ask. The scope value doubles as the commit scope for the
eventual commits.

## 2. Resolve the work folder

Task files live at:

```
<scope-docs>/work/<type-folder>/<kebab-case-slug>.md
```

Type folder names are the **plural** forms: `feat` → `feats`, `fix` → `fixes`,
`improvement` → `improvements`, `chore` → `chores` (matches the pre-existing
`docs/work/chores/`).

Create the path **lazily** — only the directories the current task needs, with
`mkdir -p`. Never scaffold empty sibling type folders or docs folders for other
scopes.

## 3. Elicit requirements

Do not write the file from the one-line request. Interview first:

- **feat** — invoke the `domain-stories` skill (via the Skill tool) with the
  user's description as input. Its elicitation and output (Need Statement +
  Job Stories per section) become the task file's Requirements section
  verbatim. Do not run the `system-requirements` skill here — EARS system
  requirements belong to solutioning, after an option is chosen.
- **fix** — ask about: observed vs. expected behavior, reproduction steps,
  impact/severity, when it started or what changed, suspected area.
- **improvement** — ask about: the current pain, the desired state, why now,
  how success will be observed.
- **chore** — ask about: what recurring maintenance this is, its trigger or
  cadence, definition of done for this occurrence.

For every type, additionally cover: **constraints** (technical, compatibility,
deadline), **non-goals** (explicitly out of scope), and anything still
undecided (becomes Open questions). Ask in rounds — follow up on unclear
answers rather than moving on. Prefer AskUserQuestion with concrete options
where choices are enumerable; free-form questions otherwise.

When elicitation feels complete, **summarize the requirements back and get
confirmation** before writing the file.

## 4. Write the task file

Filename: a kebab-case slug of the task title (like the existing
`turbo-to-bun-migration.md`). If the file already exists, show it and ask
whether to update it or pick a new name — never overwrite silently.

Template:

```markdown
---
type: <feat | fix | improvement | chore>
scope: <repo | subsystem | package name, e.g. frontend>
status: elicited
created: <YYYY-MM-DD>
---

# <Task title>

## Context

<Where this sits in the system; relevant prior decisions (link decisions.md
entries by number) and existing code/docs.>

## Problem / Goal

<What is wrong or missing, and what outcome is wanted. Problem space only.>

## Requirements

<For feats: the domain-stories output (Need Statements + Job Stories).
For other types: the elicited requirements as concise bullets.>

## Constraints

<Hard boundaries the solution must respect.>

## Non-goals

<Explicitly out of scope.>

## Open questions

<Unresolved points from elicitation, as a checklist.>

## Solution options

_To be explored — this document ends where solutioning begins._
```

Omit a section only if elicitation genuinely produced nothing for it; keep
`Solution options` always, as the marker of where the next phase starts.

## 5. Wrap up

Report the created file path and a one-line summary of the captured scope.
Remind that the next step is exploring solution options in that file, and that
whatever gets decided there should land as an entry in the scope's
`decisions.md` (root `docs/decisions.md` unless the scope has its own).
Do not start solutioning unless asked.
