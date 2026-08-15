---
type: feat
scope: server
status: specified
created: 2026-08-15
---

# Projects with connected GitHub repositories

## Context

Noesis signs users in through a GitHub App (decision 46,
[`github-login.md`](github-login.md)); both user-to-server tokens and
installation tokens are available. The UI shell (`ui-shell.md`) provides the
sidebar/workspace frame this feature will live in. All application data lives
in the single LadybugDB graph — no second datastore (see the config module's
single-data-dir rule and the reasoning recorded with decision 46).

Projects are the unit everything downstream hangs off: scanning scope first,
and later a workspace boundary for collaboration. Per the high-level
architecture (`docs/arch/high_level.png`) and decision 47, scanning itself
runs on CI or a developer's machine — the server only receives uploaded
results — so a project's repository connections define what the server may
represent and accept results for, not what the server reads. This document
captures the problem space only.

## Problem / Goal

Noesis currently has authenticated users but no way to say _which codebase_ is
being analyzed. Analysis and collaboration operate on codebases that span
multiple repositories, and GitHub-side access is governed by App installations
that Noesis does not control. Wanted outcome: members can create projects,
connect the GitHub repositories that make up a codebase, and — when a wanted
repository is not reachable by the App — grant that access on GitHub without
leaving the task.

## Requirements

### 1. A codebase needs a named home spanning its repositories

**Need Statement.** Engineers analyzing a codebase need a way to group its
repositories into a single named project, because a codebase routinely spans
several repositories while analysis, results, and future collaboration must be
scoped to the codebase as a whole — repository-by-repository handling cannot
express that boundary.

**Job Stories**

- When an engineer starts analyzing a new codebase, they want to create a
  named project and connect at least one repository to it in the same sitting,
  so they can keep its analysis separate from unrelated code from the start.
- When a codebase grows a new repository (a split-out service, an extracted
  library), an engineer wants to attach that repository to the existing
  project, so they can keep the project's picture of the codebase complete.
- When a repository stops being part of the codebase, an engineer wants to
  detach it from the project, so they can avoid results being polluted by code
  that no longer belongs.
- When an engineer tries to detach the last remaining repository, the system
  refuses and points them at project deletion instead, so a project can never
  silently become an empty shell with nothing to analyze.
- When an engineer tries to create a project under a name that already exists,
  the system refuses and identifies the existing project, so the same codebase
  never gets two ambiguous homes.
- When a project becomes obsolete, an engineer wants to delete it after an
  explicit confirmation, with the analysis data of its repositories removed,
  so stale results cannot resurface as if current.
- When any admitted member opens the workspace, they see every project and its
  connection health, so they can find and continue work regardless of who
  created the project. _(Per-project visibility is a non-goal for now.)_

### 2. Connecting repositories is bounded by GitHub App access

**Need Statement.** Engineers need a way to connect exactly those repositories
that the GitHub App can reach on their behalf — and to extend that access when
it falls short — because repository access is granted per-installation on
GitHub, outside Noesis, and a connection the App cannot verify against a real,
authorized repository would let a project claim repositories the instance has
no standing to represent or accept scan results for.

**Job Stories**

- When an engineer connects a repository to a project, they want to choose
  from the repositories reachable through their App installations — personal
  account and organization installs alike, private and public — so they can
  only ever connect repositories the instance is entitled to represent and
  receive scan results for.
- When the wanted repository is not in the list, the engineer wants to grant
  the App access to it on GitHub from right where they are, so they can finish
  connecting without abandoning the task to hunt through GitHub settings.
- When the engineer lacks the GitHub-side rights to install the App (not a
  repo admin / org owner), GitHub's own request-to-owner flow takes over; the
  engineer wants Noesis to simply reflect whatever access results, so
  responsibility for authorization stays where it lives — on GitHub.
- When an engineer returns after granting access on GitHub, they want the
  newly reachable repository to be available for connection without redoing
  their setup, so the grant round-trip costs one interruption, not a restart.
- When an engineer tries to connect a repository that already belongs to
  another project, the system refuses and identifies the owning project, so
  one repository's analysis never has two competing homes.

### 3. GitHub-side access can vanish without notice

**Need Statement.** Engineers need a way to see and recover when the App's
access to a connected repository disappears, because installations are managed
on GitHub and can be revoked or narrowed at any time without Noesis being
consulted — a project that silently pretends otherwise would present dead
repositories as live.

**Job Stories**

- When the App loses access to a connected repository (uninstall, repository
  deselected, repository deleted), members want the project to show that
  repository as disconnected while keeping its existing analysis data, so they
  can see at a glance what stopped updating without losing history.
- When a member views a project containing disconnected repositories, they
  want existing results marked as no longer current for those repositories, so
  they can avoid trusting analysis of code that may have moved on.
- When an engineer re-grants access to a disconnected repository, they want it
  to return to connected with its history intact, so a temporary GitHub-side
  change does not cost the accumulated analysis.

Coverage note: section 3 has no write/grant story of its own — granting is
covered by section 2; revocation itself happens on GitHub, outside the system.

## Constraints

- Single datastore: projects and repository connections live in the LadybugDB
  graph. No second store.
- Must work identically for personal-account installations and organization
  installations of the GitHub App.
- GitHub is the authority on who may grant the App access; Noesis implements
  no rights model of its own for that (send-to-GitHub, reflect the result).
- Scanning runs on CI or a local machine, never on the server (decision 47):
  the server never clones or reads source, and App access is not a scanning
  credential — connections exist so the server knows what it may represent
  and accept results for.

## Non-goals

- Per-project membership / visibility — v1: every admitted member sees and can
  edit every project.
- Scan execution and result ingestion — scanning runs on CI or local machines
  (decision 47), and the authenticated upload API for results is a separate
  feature; this one ends at a project with connected, App-accessible
  repositories.
- A Noesis-side "request access" workflow (tracking pending grant requests) —
  GitHub's native flow handles it.

## Open questions

All but one resolved during solutioning (2026-08-15):

- [x] **Access-state freshness:** on-demand for v1 — checked via the GitHub
      API when a project is viewed or a connection is attempted. A webhook
      endpoint for installation events is a later feature; the UI already
      surfaces connection health either way.
- [x] **Per-user visibility:** accepted for v1 — connection health means
      "the App has access", not "you have access". The instance is
      invite-only; members are trusted to see every project's repositories.
- [x] **Repository identity:** the immutable numeric GitHub repository id is
      the key; `owner/name` is display metadata refreshed on access checks.
      Renames and transfers follow automatically, and OIDC claims carry the
      id for the ingestion feature to match on.
- [x] **Deletion:** hard delete behind an explicit confirmation (type the
      project name); the project and its repositories' analysis data are
      removed. A mistaken delete is recoverable by re-connecting and
      re-scanning.
- [x] **Uploads for disconnected repositories:** refused, with the reason
      (re-grant access to resume). Disconnected means not entitled —
      consistent with connections-define-entitlement (decision 48); stored
      data stays frozen at the revocation point.
- [ ] Result-upload authentication and repository binding — owned by the
      ingestion feature (direction set in decision 48: GitHub Actions OIDC
      default, Noesis-minted credential for other CI and local runs); the
      project/repository model here must not preclude it.

## Solution options

### A. Server-side connection registry

Project–repository links live in the graph and are created through the Noesis
UI (the elicited repo-picker flow). The repository itself knows nothing about
Noesis projects; the server's registry is the single source of truth, and
scan uploads are validated against it.

### B. Repo-side project declaration

The repository carries a config file (e.g. `noesis.json`) naming the project
it belongs to. The scanner reads it and stamps uploads with it; the server
derives project membership from what arrives. The repos are the source of
truth; the server's project view is a projection of the fleet's config files.

### Comparison against the elicited requirements

- **Exclusivity (one repo, one project).** A enforces it at connect time with
  an immediate, explainable refusal. B can only detect a conflict at upload
  time — and worse, the invariant stops being well-defined: two branches of
  one repository can declare different projects, and a fork inherits the
  declaration and would upload into the original's project. B ends up needing
  server-side arbitration anyway, which is A wearing a delay.
- **Refusal stories (duplicate name, last-repo detach).** A refuses
  synchronously where the engineer is acting. In B the same conflicts surface
  asynchronously in a CI log, long after the commit that caused them.
- **Project lifecycle.** In A, create/rename/detach/delete are one action in
  one place. In B every change is a commit — times N repositories for a
  rename — and a deleted project is resurrected by the next CI run of any
  stale branch still carrying the file.
- **Project before first scan.** A gives the project immediate existence:
  connection health, the grant-access flow, and the "no empty shell" rule all
  have somewhere to live. In B nothing exists until a pipeline has run, so
  the whole elicited connection/grant flow has no home.
- **Entitlement.** Both options still need the GitHub App connection. B needs
  it _more_: an upload claiming "repository R, project P" must be verified
  against something the server trusts, or any fork or leaked token can claim
  any project.
- **Where B genuinely wins.** Config-as-code: the binding is versioned and
  reviewed with the repository; onboarding a large fleet needs no UI
  clicking; the CI upload is self-describing without a per-repo server
  lookup.

### Routing: how the scanner knows where to upload

Whatever owns the project–repo link, the scanner running in CI or locally
must route its results to the right project. Declaring the project _ID_ (not
name) in the repo fixes the rename objection to B, and refusing unknown IDs
fixes deletion-resurrection. But the exclusivity invariant makes any
repo-side declaration logically redundant: if a repository belongs to at most
one project, the server can resolve the project from the repository's
identity alone. Three routing variants:

1. **Repo-declared project ID** (`noesis.json` with an ID). Survives rename;
   still carries the fork problem (a fork inherits the ID and claims the
   original's project unless the server verifies actual repository identity —
   and once it does, the ID adds nothing but a new mismatch case), and goes
   stale when a repo is detached and connected elsewhere.
2. **CI-config binding** — project ID lives in the pipeline's variables next
   to the upload credential, not in repo content. No file to fork or go
   stale in history, but invisible to Noesis and per-pipeline to maintain.
3. **Server-side resolution** — the scanner authenticates and states which
   repository it scanned (derived from the git remote / CI context); the
   server looks up the owning project in the registry. Exclusivity guarantees
   the lookup is unambiguous. Rename, detach-and-reconnect, and deletion are
   handled by the registry with no repo-side state; a fork resolves to _its
   own_ repository identity and simply isn't connected, so hijack fails
   structurally. Requires trustworthy repository identity at upload — the
   same problem the ingestion-auth open question already owns (e.g. GitHub
   Actions OIDC attests the repository; an upload token bound to a project
   covers local runs).

### Upload authentication: why "URL only" is not enough, and why no secret is needed

Rejecting unregistered repositories does not prevent spoofing: an attacker
does not upload as an unknown repository, they claim to _be_ a registered
one. The repository identity in an upload is a claim; without attestation,
anyone holding the server URL (public, for a public repo) can upload a
poisoned model. The zero-secret attestation is **GitHub Actions OIDC**: the
CI job obtains a GitHub-signed JWT carrying `repository`/`ref`/`run_id`, and
the server verifies the signature against GitHub's JWKS and the repository
claim against the registry. No external party can make GitHub sign a token
naming someone else's repository. The repo then carries only the server URL —
no secret in the repo, none in CI.

Fallbacks where GitHub OIDC does not exist: other CI systems (their own OIDC
issuers later, or a Noesis-minted upload token in a CI secret meanwhile) and
local scans (the engineer authenticates as themselves — the same deferred
credential question as the MCP bridge, decision 46). An App-authored
onboarding PR can add the config file (and optionally the workflow) to a
repository; it requires widening the App's permissions to Contents +
Pull requests (+ Workflows) read/write, which existing installations must
re-approve — cheap to decide now, annoying later.

### Decision

**Option A, with routing variant 3 — decided as decision 48 in
[`docs/decisions.md`](../../decisions.md).** The registry in the graph is the
source of truth; the scanner states which repository it scanned and the
server resolves the owning project via the exclusivity rule; repository
identity is attested (GitHub Actions OIDC as the intended default, Noesis-
minted credentials for other CI and local runs — owned by the ingestion
feature). A repo-declared project id may return later as an onboarding hint
or App-authored PR convenience, never as the binding.

## Solution specification

### 1. Graph schema

Appended to `graph-schema.ts` under a new heading, idempotent like everything
already there. `Project` exists (Part 2); this change adds the `Repository`
table and the relationships whose shape decision 46 already settled:

```
Repository(id, full_name, private, status, status_changed_at,
           version, created_at, PK id)
```

- `id` — GitHub's immutable numeric repository id, stored as STRING for
  consistency with `GhInstallation.id`. The resolved identity question: renames
  and transfers keep the key; `full_name` (`owner/name`) is display metadata
  refreshed on every access check.
- `status` — `'connected' | 'disconnected'`; `status_changed_at` records when
  it last flipped, so the UI can say since when results are stale.

Relationships (exactly the decision-46 sketch):

```
UsesInstallation(Project → GhInstallation)     -- exactly one per project
Tracks(Project → Repository)                   -- ≥1 per project (invariant)
InInstallation(Repository → GhInstallation)
```

A repository node exists only while some project tracks it — exclusivity means
at most one — so project deletion removes its `Repository` nodes outright, and
a repository detached and reconnected elsewhere is a fresh node. Cross-org
projects stay unsupported: attach is restricted to the project's single
installation, which keeps the repo picker a flat list.

Invariants and where they are enforced (all as conditional writes in the
repository layer — the `claimOwnerAccount` pattern, never read-then-write):

| Invariant                   | Write guard                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unique project name         | `CREATE` guarded by `count(Project {name}) = 0`; zero rows back → 409 `duplicate_name` with the existing project                                             |
| One repository, one project | `CREATE (p)-[:Tracks]->(r)` guarded by no other project tracking `r`; zero rows back → re-query the owner for the 409 `repository_already_connected` payload |
| ≥1 repository per project   | Detach guarded by `count(Tracks) > 1`; zero rows back → 409 `last_repository`, pointing at deletion                                                          |

Project creation is create-then-attach across statements (the DB layer runs
single queries). If any attach is refused, the just-created project is deleted
as compensation, so a failed create never leaves an empty shell.

### 2. Backend surface

A `/ui/projects` sub-app mounted in `ui.routes.ts` behind the existing
`requireSession`, plus one picker endpoint. Response types reach the frontend
through `AppType` as everywhere else.

| Route                                           | Behaviour                                                                                                                                                                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /ui/projects`                              | All projects with repository counts and health summary (stored state, no GitHub round-trip)                                                                                                                                                                                   |
| `POST /ui/projects`                             | `{ name, installationId, repositoryIds }` — creates project + `UsesInstallation` + attaches; refuses empty `repositoryIds`, duplicate name, repos owned elsewhere                                                                                                             |
| `GET /ui/projects/:id`                          | Project detail; runs the on-demand access check first (see §3), so the response is fresh                                                                                                                                                                                      |
| `PATCH /ui/projects/:id`                        | Rename `{ name, version }` — existing optimistic-concurrency path, plus the duplicate-name guard                                                                                                                                                                              |
| `DELETE /ui/projects/:id`                       | Hard delete: project, its `Repository` nodes, and (once they exist) all rows scoped by its `project_id`. Typed-name confirmation is a UI affordance; the API deletes on DELETE                                                                                                |
| `POST /ui/projects/:id/repositories`            | `{ repositoryId }` — attach; same guards as create, plus "reachable via this project's installation"                                                                                                                                                                          |
| `DELETE /ui/projects/:id/repositories/:repoId`  | Detach; refuses the last repository                                                                                                                                                                                                                                           |
| `GET /ui/github/installations/:id/repositories` | The picker source: repositories the _acting user_ can reach through that installation (user-to-server `GET /user/installations/{id}/repositories`, paginated), each annotated with the owning project if already connected — so the picker can grey it out and name the owner |

Refusals are 409s with a machine-readable `error` slug and enough payload to
render the explanation the job stories demand (owning project id + name,
existing project on duplicate name).

**Grant-access button.** The existing `GET /auth/install` flow is reused, with
one addition: an optional `returnTo` query parameter, carried inside the signed
state cookie and validated as a same-origin relative path (open-redirect
guard). The install callback redirects there instead of `/settings`, which
gives the elicited return-trip continuity: the engineer lands back in the
connect flow, re-fetches the picker, and the newly granted repository is in the
list. For extending an _existing_ installation the UI deep-links to GitHub's
installation settings page (`github.com/settings/installations/:id` or the
organization variant) — per decision 46's note, repository selection on an
existing install is GitHub's screen, not requestable via API. GitHub's
request-to-owner flow needs nothing from us: `setup_action=request` already
lands on the callback with no installation id and is reported as "requested".

**App permissions (registration requirement).** The App must request the
repository permission **Metadata: Read-only** — the sign-in feature needed no
repository permissions at all, and an App that requests none gets no
repository-selection screen: GitHub's manage page says "This App does not
require access to your repositories", installs grant nothing, and both
listing endpoints answer empty. Metadata read is the minimum that makes
repository selection (all/selected) appear on the install screen and the
listings work. Adding it to an already-registered App means every existing
installation must approve the permission update on GitHub before selecting
repositories. The onboarding-PR permission widening (Contents + Pull
requests, decision 48) stays deferred to the ingestion feature.

### 3. Access check (first real `GhAppService` caller)

A `RepoAccessService` in `src/projects/` refreshes stored state on demand —
when a project is viewed or an attach is attempted (resolved freshness
question):

1. `GhAppService.installationOctokit(installationId)` →
   `GET /installation/repositories` (paginated) — the set the App can actually
   reach, independent of any user (resolved visibility question: health means
   "the App has access").
2. Tracked repository present in the set → `status = connected`, refresh
   `full_name`/`private` (rename/transfer follow-through). Absent →
   `status = disconnected`, stamp `status_changed_at`.
3. Installation itself gone or suspended (404/403 from GitHub) → every tracked
   repository of that project goes `disconnected`.
4. GitHub unreachable → stored state is served unchanged with a
   `healthChecked: false` flag; the check must never make the project page
   unavailable.

Re-granting access needs no special path: the next check finds the repository
present again and flips it back — history intact, as elicited.

### 4. Service layer

`ProjectsService` grows the full CRUD + connection rules; `ProjectsRepository`
holds the Cypher (guards from §1). New methods, all thin over conditional
writes: `createWithRepositories`, `list`, `getDetail` (composes the access
check), `delete`, `attachRepository`, `detachRepository`. The existing
`create`/`rename`/`findById` stay; `rename` gains the duplicate-name guard.

`GithubService` gains `listInstallationRepositories(accessToken,
installationId)` next to `listInstallations` — same Octokit, same
normalization-at-the-edge style.

### 5. Frontend

- **Shell wiring.** The placeholder project state in `shell-provider` is
  replaced by server data from `GET /ui/projects` via the typed RPC client;
  the selected project id persists in `localStorage`. `ProjectSelector` keeps
  its shape; "New project" opens the create wizard instead of the local-state
  dialog.
- **Create wizard** (dialog, two steps): name → installation picker (from
  `/ui/me`) + repository multi-select (from
  `/ui/github/installations/:id/repositories`). Footer of the empty/short list
  carries the two grant affordances: "Install on another account" →
  `/auth/install?returnTo=<current>`, and "Manage repository access on GitHub"
  → the installation's GitHub settings deep link. Repositories owned by
  another project render disabled with the owner's name.
- **Project view** (route `/_shell/project`, reached from the selector
  dropdown): repository list with status badges (`connected` /
  `disconnected since <date>`), attach (same picker), detach with
  last-repository refusal surfaced, and the delete flow — type the project
  name to enable the destructive button.
- Disconnected repositories additionally mark their results as stale wherever
  results render — a forward obligation on result views, recorded here so the
  ingestion feature inherits it.

### 6. Testing

Follows the auth feature's pattern: `github-fake.ts` grows the two repository
endpoints (user-side installation repos, installation-side accessible repos),
so unit specs drive picker, access check, and refusal paths without a network.

- `projects.repository.spec` — conditional-write guards: duplicate name, second
  owner refused, last-repo detach refused, cascade delete.
- `projects.service.spec` — create-with-repos happy path + compensation on
  refused attach, access-check transitions (connected ↔ disconnected,
  installation gone, GitHub down → stale-served).
- `projects.routes.spec` — status codes and refusal payloads per route,
  `returnTo` validation on the install flow.
- e2e — signed-in flow: create project with repos, view health, detach, delete.

### 7. Build order

1. Schema: `Repository` + three relationships; repository-layer guards.
2. `GithubService.listInstallationRepositories` + `github-fake` endpoints.
3. `RepoAccessService` on `GhAppService` (first caller).
4. `ProjectsService` rules + `/ui/projects` + picker route; `returnTo` on the
   install flow.
5. Frontend: shell wiring, create wizard, project view, delete confirmation.
6. e2e spec.

### Disabled auth mode (resolved 2026-08-15)

`NOESIS_AUTH_MODE=disabled` (the zero-setup dev mode) has no GitHub, so the
picker is empty and the ≥1-repository rule would make project creation
impossible there. Resolved: **creation is blocked in disabled mode** — the
write endpoints answer 503 `auth_disabled`, the same stance the invites
routes already take. The invariant is identical in every mode; testing the
full project flow locally means running `mode=github` with a locally
registered GitHub App (the per-deployment registration decision 46 already
assumes). Unit and e2e specs exercise the real flow against `github-fake.ts`.
