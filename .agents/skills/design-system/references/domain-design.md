# New code is shaped by the domain (DDD)

The design system is generic; everything built on it speaks the domain. Keep
the two apart so either can be read without the other.

- **Place by domain, not by kind.** Something about changes goes in
  `src/features/changes/`, about documents in `features/documents/` — never in
  a `components/` or `utils/` grab-bag. Only what is genuinely domain-free and
  used by more than one feature goes to `src/shared/ui/` (`IconHeading`,
  `CardLink`, `StatusPanel`). A new domain gets a new feature folder with the
  usual `<domain>.api.ts`, `<domain>.model.ts` and `ui/`.
- **Name things in the ubiquitous language.** Components, props and files use
  the words the backend and the docs use — `Change`, `ChangeStatus`,
  `DesignDocument`, `Document` — not UI words (`ItemCard`, `data`, `info`). A
  prop is `change: Change`, not `item: any`. The domain types come from the
  backend contracts (`#backend/*`, type-only); do not redeclare them.
- **Domain rules live in the model, not the markup.** What a status means, its
  label, its colour, how items are grouped or sorted belongs in
  `<domain>.model.ts` (as `CHANGE_STATUS_META` in `changes.model.ts`), and
  components read it. A `ui/` file decides layout; it does not decide what a
  `done` change is.
- **Domain primitives are value objects** — the `value-objects` skill.
- **Small, single-purpose pieces.** A view composes named sub-components
  (`overview/overview-section.tsx`, `overview-stat.tsx`), each doing one thing,
  rather than one long component. A reader should get the page from the view's
  JSX alone.
