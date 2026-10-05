# Proposing a design

"New" means a component or wrapper that does not exist yet, a new visual
pattern (a new kind of card, panel, badge usage, layout), or a visible change
to an existing one. Reusing existing pieces the way the app already uses them
is not new — just build it.

For new things, stop before writing code and show the user a proposal:

- what it looks like — a mockup built from the existing design-system
  components (a claude.ai/design design using the synced Noesis design system
  when that is available; otherwise an ASCII sketch in an `AskUserQuestion`
  preview, with an alternative or two when there is a real choice);
- which existing wrappers it uses, and which Mantine components need a new
  wrapper;
- where each piece goes and what it is called (`domain-design.md`);
- states: empty, loading, error, long content, light and dark.

Build only what was approved. If building shows the design cannot work as
proposed, come back with the change rather than improvising a different one.
The proposal step exists because a component, once used in a few views, is
expensive to redesign, and the user owns how the product looks.
