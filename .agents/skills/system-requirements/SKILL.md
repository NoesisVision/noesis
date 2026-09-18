---
name: system-requirements
description: >
  Derive system requirements from job stories (problem space) plus a high-level
  design (solution shape), write them in EARS notation, and lint them against an
  INCOSE quality-rule subset. Use when the user asks to write, derive, restructure,
  or review system requirements / system behaviors / a system requirements spec —
  especially when they want EARS-format "the system shall..." statements traced
  back to domain stories or needs. Companion to the domain-stories skill: that one
  owns the problem space, this one owns the solution space, linked by Fulfills.
---

# System Requirements (EARS + INCOSE)

Produce a **solution-space** artifact: system behaviors written in EARS notation, each
linked upward to the job stories or needs it fulfills, each passing an INCOSE quality
lint. This is the downstream half of a two-artifact model.

- **Problem space** (`domain-stories`): Need Statements + Job Stories. Stable. Never
  references solutions.
- **Solution space** (this skill, `system-behaviors`): EARS requirements. Changes when the
  design changes. References stories via `Fulfills:`.

**The only link is solution → problem, many-to-many.** One requirement may fulfill several
stories; one story may be fulfilled by several requirements. Never nest requirements under
stories — organize requirements by system capability and let `Fulfills:` carry the link.
See [[domain-stories]] for the problem-space half.

## Inputs

1. **Job stories** — the problem-space source (IDs like `DS-charger-company-view`). Required.
   If absent, ask for them or offer to run `domain-stories` first; do not invent stories.
2. **High-level design** — the solution shape that constrains _what systems exist_ and
   _what they're responsible for_ (services, components, boundaries, key data, the authz
   model, etc.). This is what lets you name a concrete system as the EARS subject. If it's
   missing or too vague to name subjects and responses, ask 2-3 targeted questions before
   drafting — do not invent architecture.

## Process

1. **Inventory the systems.** From the high-level design, list the named subjects that can
   carry a `shall` (e.g. "authorization service", "listing service", "catalog manager").
   Each EARS requirement's subject must be one of these — never "the system" generically if
   a more specific named element exists, never a person.
2. **Walk each job story and derive behaviors.** For each story, ask: what must which system
   _do_ for that outcome to hold? Express each as an EARS sentence (patterns below). One
   story often yields several requirements (happy path, state constraint, refusal); several
   stories often collapse into one general requirement — prefer the general one and list all
   the stories it fulfills.
3. **Sweep the unwanted-behavior space.** For every event/state requirement, ask "what's the
   failure, the conflict, the out-of-context case?" and write the `If…then` requirement. In
   an authz/contextual domain these refusal requirements are often the highest-value ones.
4. **Add the `Fulfills:` line** to every requirement (≥1 story or need ID).
5. **Quantify non-functionals** as quality scenarios with a response measure (below).
6. **Lint** every requirement against the INCOSE subset, then run the coverage checks.

## EARS patterns (the format of every functional requirement)

Fixed clause order; the subject is always a named system; the obligation is always `shall`.

| Pattern           | Template                                                                                         | Use for                              |
| ----------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Ubiquitous        | The `<system>` shall `<response>`.                                                               | always-active rules                  |
| Event-driven      | **When** `<trigger>`, the `<system>` shall `<response>`.                                         | response to an occurrence            |
| State-driven      | **While** `<state>`, the `<system>` shall `<response>`.                                          | behavior bounded by a mode/context   |
| Unwanted behavior | **If** `<condition>`, **then** the `<system>` shall `<response>`.                                | failures, conflicts, refusals        |
| Optional feature  | **Where** `<feature is included>`, the `<system>` shall `<response>`.                            | behavior present only with a feature |
| Complex           | Combinations, e.g. **While** `<state>`, **when** `<trigger>`, the `<system>` shall `<response>`. | use sparingly                        |

Rules:

- Exactly one `shall` per requirement (one obligation). Split compound requirements.
- Keep the keyword order. The trigger/state/condition comes before the system, the response
  after `shall`.
- The response is observable system behavior, not an internal mechanism unless the design
  fixes it ("shall return only…", "shall reject and identify…", not "shall loop over…").

## INCOSE lint (apply to every requirement before presenting)

A pragmatic subset of the INCOSE _Guide to Writing Requirements_ rules — enough to catch the
common defects at markdown weight:

- [ ] **Singular** — one `shall`, one thought. No "and also", no embedded lists of behaviors.
- [ ] **Unambiguous** — no vague terms: _fast, quickly, user-friendly, appropriate, efficient,
      robust, etc., minimize, maximize, support, handle_. Replace with a measurable response.
- [ ] **Verifiable** — a tester could write a pass/fail check. If you can't, it's vague or it's
      a goal, not a requirement.
- [ ] **Quantified with units** — every quantity has a unit and, where relevant, a tolerance or
      percentile ("within 2 s at the 95th percentile", not "within 2 s" if load varies).
- [ ] **No escape clauses** — no _where possible, if appropriate, as applicable, etc., and/or_.
- [ ] **Active voice, named subject** — "the listing service shall…", never "it should be
      possible to…" or passive "shall be shown".
- [ ] **shall** for obligations — not _should / will / must / may_. Reserve `should` for
      genuine non-mandatory goals and mark them as such.
- [ ] **Defined terms** — every domain term (privilege, role, context, scope, boundary) used
      with one consistent meaning; list them in a Glossary section and don't drift.
- [ ] **Solution-free of design not yet decided** — state _what_ the system does, not _how_,
      unless the high-level design has fixed the how.

A requirement can be perfect EARS and still fail this lint ("When the user logs in, the system
shall respond quickly" — fails Unambiguous + Verifiable + Quantified). EARS gives structure;
INCOSE gives content quality. Both must pass.

## Non-functional requirements (quality scenarios)

Don't force NFRs into a single `shall` sentence. Write them as six-part quality scenarios so
the response measure makes them verifiable:

```
Source:           <who/what generates the stimulus>
Stimulus:         <the condition/event>
Artifact:         <which system element>
Environment:      <operating condition, e.g. peak load>
Response:         <what the system does>
Response measure: <the quantified, testable threshold>
Fulfills:         <story/need IDs>
```

Most NFRs attach to a capability or a whole section, not one story, and are the most-reused
links of all (one latency scenario covers every read story). Tag each with the quality
dimension(s) it addresses (performance, security, operability…); a single scenario may carry
several tags.

## Output format

Organize by **system capability**, not by story section. Stable slug IDs, never positional
numbers (`SR-CTX-001`, not `3.2`), so renumbering can't break links.

```
## <Capability area> (e.g. Context resolution & filtering)

SR-CTX-001  (event-driven)
  When a user requests a resource list, the listing service shall return only
  resources within the contextual boundary of the user's matching assignment.
  Fulfills: DS-charger-fleet-view, DS-charger-company-view, DS-charger-country-view

SR-CTX-002  (unwanted behavior)
  If a requested resource lies outside every assignment's contextual boundary,
  then the listing service shall omit it and record an authorization-denied event.
  Fulfills: DS-charger-company-view, DS-tariff-country-scope
```

## Coverage & link validation (run whenever either artifact changes)

These mirror Jama-style traceability, done in markdown + a small script — see [[domain-stories]].

- **Every requirement has ≥1 `Fulfills:`** — a requirement tracing to no story/need is
  solutioning without a problem. Delete it or find the story it serves.
- **Every job story is fulfilled by ≥1 requirement** — an unreferenced story is _unspecified_.
  Acceptable in discovery; flag it before build.
- **Coverage is computed, never hand-stored** — generate the story→requirement matrix by
  scanning `Fulfills:` lines; don't maintain the reverse direction by hand (it drifts).
- **Suspect-on-change (optional but recommended)** — keep a content hash per story ID in the
  generated matrix. When a commit changes a story's text, flag every requirement whose
  `Fulfills:` references it as _suspect_ until a human reviews and regenerates the matrix.
  This is the git-native equivalent of Jama suspect links, and it's why the link points
  solution → problem: when the problem moves, you learn exactly which solutions to re-check.

## Quality gates (before presenting any draft)

- [ ] Every functional requirement is a valid EARS pattern with one `shall`.
- [ ] Every requirement passes the INCOSE lint above.
- [ ] Every requirement subject is a named system element from the high-level design.
- [ ] Every requirement has a `Fulfills:` line with valid story/need IDs.
- [ ] Refusal/unwanted-behavior requirements exist for each contextual or integrity rule.
- [ ] NFRs are quality scenarios with quantified response measures, not vague `shall`s.
- [ ] No requirement restates a job story's wording — it states system behavior, not user want.
- [ ] When restructuring an existing spec, list separately anything dropped (with reason) so
      nothing disappears silently.
