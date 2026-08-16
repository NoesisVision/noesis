---
type: feat
scope: server
status: implemented
created: 2026-08-16
---

# Inbox

**Prototype:** [`inbox-prototype.html`](./inbox-prototype.html) — single-file
HTML mock (open in a browser); full shell chrome with Inbox active, functional
triage over in-memory sample data: dismiss-with-reason, defer, promote-to-task
stub, quick capture, dedup folding, event countdowns and expiry, aging
escalation, and inbox-zero empty state. Build plan and design notes:
[`inbox-prototype-plan.md`](./inbox-prototype-plan.md).

## Context

Noesis serves project teams (decision 48: projects own their repositories in a
server-side registry). Today there is no place inside noesis where things that
demand a reaction — alerts, meeting outcomes, upcoming events — accumulate;
they live in the systems that produced them. A task/work module is planned but
does not exist yet; the inbox is its upstream funnel. Identity is the GitHub
App flow (decision 46); the UI shell and search provider registry are decision 45. This task doc follows decision 43 (typed, scoped task docs under
`docs/work/`).

## Problem / Goal

Signals a team must react to are scattered across monitoring channels,
meetings, calendars and chat. Each extra place to watch is a place where
something gets missed, and follow-ups agreed in meetings never become tracked
work. The goal is a single
per-project team inbox where every such signal lands — pushed automatically or
entered by hand — and where each item visibly ends in one of three states:
promoted to (future) work, dismissed with a reason, or expired.

## Requirements

### 1. Scattered signals need one landing place

**Need Statement.** Project teams need a way to gather every reaction-worthy
signal — alerts, meeting outcomes, upcoming events, ad-hoc observations — into
one shared team place, because signals arrive scattered across monitoring
systems, meetings, calendars and chat, and every additional place a team must
watch is a place where something gets missed.

**Job Stories.**

- When an external system detects a condition worth human attention, the
  project team wants that signal to appear in their inbox carrying its origin
  and enough context to act on, so they can react without keeping watch on the
  source system itself.
- When a team member notices something reaction-worthy mid-work (a risk, a
  request, a follow-up), they want to drop it into the team inbox in seconds,
  so they can capture it before it is forgotten without derailing their
  current task.
- When a meeting ends and its transcript is available, the team wants the
  transcript to land in the inbox as a single reviewable item, so that
  follow-ups agreed in the meeting cannot silently evaporate.
- When an upcoming event enters the team's look-ahead window, the team wants
  it present in the inbox alongside every other signal, so preparation
  competes for attention in the same place instead of in a separate calendar.
- When a signal arrives that cannot be attributed to a known project or an
  authorized sender, the project team wants it refused — never silently mixed
  into their inbox — so they can trust that every item they see belongs to
  them. _(integrity)_

### 2. Repetition must not bury the signal

**Need Statement.** Teams need a way to see one repeating condition as one
item, because a flapping source emits dozens of identical signals overnight,
and that volume buries the few items that genuinely need a human.

**Job Stories.**

- When the same condition fires repeatedly, the team wants the repeats folded
  into the existing item with an occurrence count and a last-seen time, so the
  inbox stays readable under noise.
- When a member triages a folded item, they want to see its occurrence history
  (first seen, last seen, count), so they can judge how serious the condition
  is before reacting.
- When a signal arrives without anything identifying it as a repeat, the team
  wants it treated as a new item rather than guessed into an existing one, so
  distinct problems are never silently merged. _(integrity)_

### 3. Clearing the inbox must not lose the "why"

**Need Statement.** Teams need a way to clear items out of view without losing
the record of what happened to them and why, because an inbox that only grows
becomes noise, while removals that leave no trace destroy the team's trust
that nothing was dropped.

**Job Stories.**

- When an item is noise, already known, or a duplicate, a member wants to
  dismiss it with a stored reason visible to the team, so it leaves the view
  without teammates wondering whether it was simply dropped.
- When an item matters but not now, a member wants to defer it until a chosen
  moment and have it resurface on its own, so the current list stays short
  without anyone trusting their memory.
- When an item is real work, a member wants to mark it as promoted to a task,
  so the inbox records that it graduated — and the future task module has a
  defined place to pick it up from.
- When a team member suspects something was wrongly dismissed, they want to
  find dismissed items together with their reasons, so triage mistakes are
  recoverable rather than final. _(read/integrity)_
- When items sit untouched, the team wants their age loudly visible and old
  items impossible to overlook, so nothing dies quietly at the bottom of a
  list.

### 4. Time-bound signals expire

**Need Statement.** Teams need time-bound signals to surface ahead of their
moment and retire after it, because an event that needs preparation is
worthless to discover once it has happened, and expired events left in view
are pure noise.

**Job Stories.**

- When an event within the look-ahead window exists in a connected calendar,
  the team wants it in the inbox showing how much time remains, so they can
  prepare while preparation is still possible.
- When a member defers an event item, they want the deferral bounded by the
  event's start, so a snooze can never skip past the moment the item exists
  for. _(integrity)_
- When an event's time passes with its item unhandled, the team wants the item
  to retire itself as expired — distinct from handled — so the inbox does not
  accumulate dead entries, while missed events remain visible as missed.
  _(lifecycle)_

## Constraints

- Team boundary is the existing **project** (decision 48); the inbox is
  per-project. No new team/membership entity.
- Intake must be designed so future automatic sources — notably coding agents
  via the MCP bridge — can plug in without redesigning it (source-agnostic
  signal contract).
- Promotion to task is a forward-compatible stub: the task module does not
  exist yet, but a promoted item must carry enough to be picked up later.
- Deduplication relies on a sender-provided dedup key; no content-based
  guessing.
- Notifications are in-app only in v1.
- Transcripts arrive by API push or through manual capture, which accepts an
  attached file of any kind; a transcript is one item (no extraction).
- Calendar events come from a Google Calendar integration and/or API push;
  all events within the window land (no filtering rules).
- Identity/auth rides on the existing GitHub App flow (decision 46).

## Non-goals

- Item ownership: no claiming, assigning, or per-item accountability — the
  inbox stays team-owned and items are acted on, not held.
- AI extraction of action items from transcripts (a transcript is one item).
- Outbound notifications (email, Slack, push).
- Escalation automation for aging items (aging is visible, nothing more).
- Priority/severity field of any kind.
- Personal (per-user) inboxes.
- Coding agents as a signal source (MCP tool) — designed for, not built.
- External tracker integration (Jira/Linear/GitHub Issues).
- Meeting-bot integrations (Zoom/Meet/Teams).
- The task/work module itself.

## Open questions

- [ ] Google Calendar: OAuth per user or per project? Which grants the team
      window without per-member setup?
- [ ] Look-ahead window size — fixed (e.g. 7 days) or per-project setting?
- [ ] Retention of dismissed and expired items — forever, or a purge horizon?
- [ ] Webhook/API auth model — per-project ingest key? Rotation?
- [ ] A condition fires again after its item was dismissed — new item,
      reopened item, or suppressed for some cool-down?
- [ ] Snooze semantics for non-event items — date only, or also "until next
      occurrence" for deduped alerts?

## Solution

Implemented (decision 49): `InboxItem` graph nodes under their project
(`server/backend/src/inbox/`), conditional-write state transitions, read-time
expiry/wake sweeps, and two `/ui` intake endpoints — manual capture and a
source-agnostic `/signals` contract. The Inbox view is the top item in the
shell sidebar (`server/frontend/src/routes/_shell/inbox.tsx`,
`server/frontend/src/components/inbox/`): Open/Handled/Expired tabs, pinned
aging section, snoozed group, triage detail in the right panel, quick capture
with file attachment. External push auth stays open — `/signals` rides the ui
session until the ingest-auth question is answered.
