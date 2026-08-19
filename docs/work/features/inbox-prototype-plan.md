# Inbox HTML prototype

> Status: built and iterated. This file reflects the prototype as it stands
> after review feedback: **ownership (claim/assign) removed**, **capture
> gained a generic file attachment**. `inbox.md` was updated to match
> (requirement "Seen-by-all must become owned-by-one" dropped; ownership is
> now a non-goal; aging job story moved under "Clearing").

## Context

`docs/work/features/inbox.md` (status `elicited`) specifies a per-project team inbox: one landing place for alerts, meeting transcripts, calendar events and manual notes, with dedup folding, dismiss-with-reason / defer / promote-to-task, loud aging, and expiry of time-bound events. Repo precedent (`ui-shell.md`, `projects.md`) is a single-file HTML prototype committed next to the feature doc so the triage UX can be felt and reviewed before solutioning.

Decisions during review: full shell chrome, functional mock, all four surfaces (triage list + detail panel, handled/expired review, quick capture, empty state). Ownership was prototyped, reviewed, and **cut** — the inbox stays team-owned.

## Deliverables

1. `docs/work/features/inbox-prototype.html` — single self-contained file, no doctype/html/head/body wrapper: `<title>Noesis Inbox</title>`, one `<style>`, markup, one `<script>`. No external assets, no libraries.
2. `docs/work/features/inbox.md` — `**Prototype:**` link line under `# Inbox`; spec kept in sync with prototype cuts (ownership removed).
3. Passes `bun run lint` (biome 2.5; only pre-existing warnings) and `bun run lint:md`.

## Conventions (verified in repo)

- **Theme tokens**: full token block from `ui-shell-prototype.html` (includes `--sidebar-*`, `--ok`), header comment verbatim: `/* ---- Claude theme tokens (from server/frontend/src/index.css) ---- */`. Theme mechanics from `projects-welcome-prototype.html` (data-theme only): `:root` light → `@media (prefers-color-scheme: dark)` guarded `:root:not([data-theme="light"])` → explicit `:root[data-theme="dark"]`; topbar toggle flips `root.dataset.theme`.
- **Shell chrome**: sidebar/topbar/breadcrumb subset of `ui-shell-prototype.html`. Nav = Dashboard, Graph, Documents (matches `server/frontend/src/components/shell/nav-items.ts`) + **Inbox** (active, `aria-current="page"`) + Settings pinned bottom; non-inbox items inert. Breadcrumb `acme-orders › Inbox`; visible `Prototype` badge.
- **Icons**: inline lucide-style SVGs, 24×24 stroke, `aria-hidden="true"`, shared `.icon` class.
- **JS style**: `$`/`$$` helpers, template-literal renderers, HTML-escaped user text. No localStorage — fresh sample data per load.
- **Biome/a11y**: real `<button type="button">` everywhere; `aria-label` on inputs/dialogs; `role="listbox"`/`role="option"` with managed `aria-selected`; two targeted `biome-ignore lint/a11y/useSemanticElements` comments (listbox groups, seg tab group), matching shell-prototype precedent.

## Information architecture

**Tabs** (seg buttons, `aria-pressed`): **Open (n) | Handled (n) | Expired (n)**.

- Open: pinned **"Aging — do not let these sink"** section (open items > 4 days) → main list newest-activity-first → dimmed **"Snoozed — will return"** group with wake times.
- Handled: dismissed items (reason + restore) and promoted items (graduation record).
- Expired: events that passed unhandled, framed as "missed" (distinct from handled).

**Row anatomy**: source icon (bell/file-text/calendar/pencil) · title + meta line · `×N` occurrence pill (count > 1) · countdown chip (events) · age chip.

**Detail panel**: type + state chip header · title · `.kv` grid (source, received, dedup key) · occurrence history (first/last seen, count, recent timestamps) · event block (start + live countdown) · body (payload / transcript excerpt / note) · outcome block (dismissal reason + who/when + Restore; promotion record "waiting for the task module"; expiry record) · action bar: **Defer ▾ · Dismiss… · Promote to task**.

**Cut features**: no ownership card, no claim/assign, no conflict callout, no owner chips. **No priority/severity field** (spec non-goal), no personal inbox, no notifications.

## Sample data (~12 items, `sampleItems()` factory, `Date.now()`-relative)

Team constant retained for attribution only (outcome.by, origins): Ada (you), Mira, Jonas, Priya.

1. Alert "CPU saturation on billing-service pod" — Grafana, ×37, first 3d / last 12m (dedup showcase)
2. Alert "Nightly backup job failed" — ×2
3. Alert "TLS cert expires soon" — 12 days old (pinned aging showcase)
4. Transcript "Weekly architecture sync" — pasted, 4h
5. Transcript "Incident post-mortem" — API push, 2d
6. Event "Quarterly security review" — starts ~26h, countdown, defer bounded by start
7. Event "Stakeholder demo" — starts 3h (imminent tint)
8. Event "Dependency upgrade window" — started 1d ago unhandled → Expired tab
9. Note "Rate limiter config too permissive" — by Priya, 30m
10. Note "Review on-call rota proposal" — deferred until tomorrow 09:00 → snoozed group
11. Alert "Disk usage warning ci-runner-3" — dismissed by Jonas with reason → Handled
12. Note "Add missing index on events table" — promoted by Mira 3d ago → Handled

Item shape: `{ id, kind, title, origin, body, dedupKey?, createdAt, lastSeenAt, count, occurrences[], eventStart?, snoozedUntil?, state ('open'|'dismissed'|'promoted'|'expired'), outcome?: {by, at, reason?} }`.

## Interaction flows

- **Dismiss**: `<dialog>` with required reason textarea (confirm disabled while empty) → state `dismissed`, outcome recorded, moves to Handled; panel shows reason + **Restore to inbox**.
- **Defer**: presets _Later today (+4h)_ / _Tomorrow 09:00_ / _Next week (Mon 09:00)_; for events, presets past `eventStart` disabled with hint "after the event starts". Snoozed rows show wake time; **Wake now** in panel. Auto-wake when `snoozedUntil` passes.
- **Promote**: one click → `promoted`, records who/when, Handled tab, stub note "waiting for the task module".
- **Quick capture**: "+ Capture" button (+ `c` hotkey) → `<dialog>` with title, optional note, and **"Attach file"** (generic — any file type, no `accept` filter; label + visually-hidden file input; filename display + remove button). File picked: title auto-fills from filename if empty; first 4k chars read via FileReader into item body. With attachment → **transcript** item, origin "uploaded by Ada · filename"; without → plain note.
- **Tick**: 30s `setInterval` re-renders countdowns; open event past start auto-transitions to `expired`.
- **Empty state**: Open tab with zero non-snoozed items → dashed card: "Inbox zero", snoozed-count line, "Reset sample data" button; persistent reset icon-button in toolbar.

## Age loudness (all open, non-snoozed items — no ownership dimension)

- < 24h: quiet muted age in meta line.
- 1–4d: tinted chip — `color-mix(in oklch, var(--primary) 14%, transparent)` bg, `var(--primary)` text ("3d waiting") + 3px primary left border on row.
- > 4d: hoisted to pinned "Aging — do not let these sink" section; solid primary chip ("Waiting for 12 days").
- Event imminence (< 6h) reuses tinted chip on countdown.

## Spec (`inbox.md`) changes made alongside the prototype

- Removed requirement "Seen-by-all must become owned-by-one" (all four job stories); sections renumbered (Clearing → 3, Expiry → 4).
- Aging job story preserved, reworded without ownership ("When items sit untouched…"), moved under "Clearing the inbox must not lose the why".
- Problem/Goal: dropped "team-visible signals with no owner die unclaimed".
- Non-goals: added "Item ownership: no claiming, assigning, or per-item accountability".
- Constraints: transcripts arrive "by API push or through manual capture, which accepts an attached file of any kind".
- Open questions: removed the assign-acceptance question.
- `**Prototype:**` description line reflects current feature set.

## Verification

- Browser walkthrough (Chrome), light + dark: all tabs, every flow above, drive to inbox zero, reset.
- `bun run lint` — clean apart from 2 pre-existing warnings (same class as ui-shell prototype); `bun run lint:md` clean.
- Embedded `<script>` syntax-checked with `node --check`.

## Critical files

- `docs/work/features/inbox-prototype.html` — the deliverable
- `docs/work/features/inbox.md` — spec, kept in sync
- `docs/work/features/ui-shell-prototype.html` — chrome/tokens source
- `docs/work/features/projects-welcome-prototype.html` — theme-toggle + seg patterns
- `biome.json` — lint rules
