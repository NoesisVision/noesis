// Central declarative graph schema (OQ-2.1). Every node/rel table lives here, in
// one place, so the schema is diffable at a glance and the schema-explorer can
// read it as the single source of truth. Each later part appends its own tables
// under its heading rather than scattering `CREATE … TABLE` across repositories.
//
// All statements are idempotent (`IF NOT EXISTS`) so they run on every boot.
// The DB is authoritative (no rebuild-from-files), so schema changes are
// explicit migrations, not "recreate + re-index" (OQ-2.3).
//
// Every mutable row carries a `version` (INT64) for optimistic concurrency
// (OQ-2.3), and — once artifacts land in Parts 3–6 — a `project_id` (STRING)
// for tenant scoping (OQ-2.2).
export const GRAPH_SCHEMA: readonly string[] = [
  // --- Projects (Part 2) ---
  `CREATE NODE TABLE IF NOT EXISTS Project(
     id STRING,
     name STRING,
     version INT64 DEFAULT 0,
     created_at STRING,
     PRIMARY KEY(id)
   )`,

  // --- Identity: GitHub App sign-in (decision 46) ---
  //
  // `Account` rather than `User`: this is a login identity, leaving the name
  // `User` free for a future domain notion of a person. `role` is a string
  // rather than an `is_owner` boolean so a third role costs no migration.
  `CREATE NODE TABLE IF NOT EXISTS Account(
     id STRING,
     gh_user_id INT64,
     login STRING,
     name STRING,
     avatar_url STRING,
     email STRING,
     role STRING,
     version INT64 DEFAULT 0,
     created_at STRING,
     PRIMARY KEY(id)
   )`,
  // `id` is the SHA-256 of the cookie token, never the token itself, so a
  // database read cannot impersonate anyone.
  `CREATE NODE TABLE IF NOT EXISTS Session(
     id STRING,
     created_at STRING,
     expires_at STRING,
     PRIMARY KEY(id)
   )`,
  // Tokens sit on their own node rather than as Account properties, so no
  // query that reads a user can accidentally select a credential and rotation
  // touches one row. Both token columns are AES-256-GCM ciphertext.
  `CREATE NODE TABLE IF NOT EXISTS GhCredential(
     id STRING,
     access_token_enc STRING,
     access_expires_at STRING,
     refresh_token_enc STRING,
     refresh_expires_at STRING,
     version INT64 DEFAULT 0,
     created_at STRING,
     PRIMARY KEY(id)
   )`,
  // `id` is GitHub's own installation_id. A Project reaches these by a second
  // relationship once project CRUD exists; today they hang off Account only.
  `CREATE NODE TABLE IF NOT EXISTS GhInstallation(
     id STRING,
     account_login STRING,
     account_type STRING,
     repository_selection STRING,
     created_at STRING,
     PRIMARY KEY(id)
   )`,
  // Invites are by GitHub login, not email: the login is what the OAuth
  // callback can verify, while /user's email may be private or unverified.
  `CREATE NODE TABLE IF NOT EXISTS Invite(
     id STRING,
     gh_login STRING,
     invited_by STRING,
     created_at STRING,
     accepted_at STRING,
     PRIMARY KEY(id)
   )`,
  `CREATE REL TABLE IF NOT EXISTS HasSession(FROM Account TO Session)`,
  `CREATE REL TABLE IF NOT EXISTS HasCredential(FROM Account TO GhCredential)`,
  `CREATE REL TABLE IF NOT EXISTS HasInstallation(FROM Account TO GhInstallation)`,
];
