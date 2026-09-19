---
name: implement-design-doc
description: Implement a Noesis design document in the codebase — turn its use cases, rules, building blocks, behaviours and acceptance scenarios into code and tests, in the vocabulary the document uses. Use when the user asks to implement, build or code a designed change.
---

# Implement a design document

The design document is the specification; the code is its implementation. The
vocabulary of the document — building block names, behaviour names, actor
names — is the vocabulary of the code.

## Steps

1. **Find the document.** Call `list-changes`, then `list-design-docs` for
   the change, and read the document from its path.
2. **Map the design onto the code.** Call `scan-system-model`, then for each
   building block find where it lives or should live: the
   `.noesis/graph/system-model/` files list the exported classes and their methods
   with file and line. Each `boundedContextId` and
   `domainModuleId` says where a block belongs; `implements` says what it
   must satisfy.
3. **Implement in the order the document reads.** For each use case: the
   entry behaviour on its application service, the rules as enforced
   invariants (name them after the rule text), the input and output fields
   by their `name` and `type`, then every acceptance scenario as a test with
   the scenario's title and its Given/When/Then as the test's structure. A
   `scenarioOutline` becomes one parameterised test over its `examples`.
4. **Keep the document honest.** When the code has to differ from the design
   (a rule turns out wrong, a block is split), stop and tell the user; then,
   if they agree, revise the document with the `update-design-doc` skill
   before the code, so the record stays true. Do not silently diverge.
5. **Report** which use cases and scenarios are implemented, which tests
   cover them, and what was left out and why.

## Rules

- Do not rename what the document names. If a name is wrong, change it in
  the document first.
- Quality attributes are requirements: a performance or security attribute
  needs a test or a measurement, not a comment.
