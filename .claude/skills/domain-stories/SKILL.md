---
name: domain-stories
description: >
  Write requirements as domain stories: a kite-level Need Statement plus
  sea-level Job Stories per capability area. Use when the user asks to write,
  extract, restructure, or review user stories, requirements, or need
  statements for a feature/domain — especially when they want problem-space,
  outcome-focused stories rather than "As a user I want..." feature tickets.
  Input can be a topic, rough notes, an existing requirements doc, or a
  transcript of a domain conversation.
---

# Domain Stories

Produce requirements as **sections**, each covering one domain tension. A section is a
two-altitude unit: one **Need Statement** (the problem, kite altitude) decomposed into
**Job Stories** (observable outcomes, sea level). Never produce solution-space stories,
UI prescriptions, or "As a developer..." items.

## Process

1. **Identify the actors and the tension.** From the input, list the concrete operational
   roles involved (specific jobs like "customer support agent", "EV pricing operator" —
   never "user" or "admin user" unless administration genuinely is the job). Find what
   makes the area non-trivial: the structural force a naive solution would miss.
   If the domain input is too thin to name real roles, triggers, or the structural force,
   ask the user 2–3 targeted questions before drafting — do not invent plausible-sounding
   specifics.
2. **Draft the Need Statement** (template below). The `because` clause must carry the
   structural force; if the statement still reads sensibly without its `because` clause,
   it is a feature request, not a need — rewrite it.
3. **Decompose into Job Stories** (template below), 3–6 per section. Sweep the four
   coverage rows (below) so refusal and lifecycle stories aren't forgotten.
4. **Self-check** every story against the quality gates, then run the completeness
   heuristic on each section.

## Need Statement (discovery level, one per section)

```
<Operational role/team> need a way to <domain capability, solution-neutral>,
because <the structural reason the current or naive approach cannot work>.
```

Rules:
- The subject is whoever **owns the problem**, never the building team.
- The capability is named at domain level — no mechanism (no scopes, claims, tables,
  endpoints, components, screens).
- The `because` clause is the load-bearing part: it names the force that makes the need
  real and arguable (e.g. "flat role lists cannot capture contextual rules that vary by
  country, partner, or location").

## Job Story (outcome level, 3–6 per section)

```
When <concrete role> <does a real task in a real situation>,
they want <observable outcome at one-sitting granularity>,
so they can <value gained or risk avoided in the domain>.
```

Rules:
- **Trigger is situational, not navigational**: "gives a person multiple
  responsibilities", "the business expands into a new country" — not "clicks the tab".
  The trigger's subject may be the business itself, not the actor.
- **The want is an outcome the system exhibits**, not a UI or design: "see only chargers
  belonging to their company" — never "a dropdown", "a filter", "a page".
- **The `so they can` names avoided harm at least as often as gained value**: "avoid
  acting on unrelated assets", "avoid one assignment silently widening another".
- **Sea-level granularity** (Cockburn): one role, one sitting, one goal — a task taking
  roughly 2–20 minutes. If the verb spans days or organizations, it belongs in a Need
  Statement; if it takes seconds and has no standalone domain value, it is a subfunction —
  fold it into a story, don't write it as one.
- **Guard-rail stories are first-class**: when the right behavior is refusal, write it as
  its own story, and have the system refuse *and explain* — "refuse and point them at the
  existing assignment", "refuse and identify what still depends on it".
- Two stories may share a trigger and differ only by role — that is the canonical way to
  express "same capability, different data per role". Keep them as separate stories.

## Section anatomy

```
N. <Theme phrased as a domain tension, plain words>
   Need Statement   ← 1, kite altitude
   User Stories     ← 3–6, sea level, each independently deliverable
```

Coverage rows to sweep when decomposing (most sections need stories from several):
- **read** — who sees what (visibility, slicing by role/context)
- **write/grant** — who may change what, and within what boundary
- **lifecycle** — add, revoke, evolve over time (new capabilities, regions, retirement)
- **integrity** — what the system must refuse, with the reason surfaced to the actor

## Quality gates (apply to every draft before presenting)

- [ ] No story mentions a UI element, component, API, or data structure.
- [ ] No story has the building team as actor ("As a developer/we want to refactor...").
- [ ] Every Need Statement collapses without its `because` clause (proves it's a need).
- [ ] Every role is a specific job someone holds, not a persona archetype.
- [ ] Every `so they can` states domain value or avoided harm — not a restatement of the want.
- [ ] Each section has at least one integrity/refusal story, or you've consciously noted
      why none applies.
- [ ] Completeness heuristic: for each section, check the four coverage rows; name any
      row you left empty and why, rather than skipping it silently.

## Output

Emit the sections in the format above (numbered theme, "Need Statement" paragraph,
"User Stories" list). When restructuring an existing document, preserve the author's
domain vocabulary and section ordering unless asked otherwise, and list separately any
original items you dropped because they were solution-space — with a one-line reason —
so nothing disappears silently.
