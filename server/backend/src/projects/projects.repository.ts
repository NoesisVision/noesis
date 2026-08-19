import { newUuid } from '@repo/shared-contracts/uuid';
import { ConcurrencyConflictError } from '../database/concurrency.js';
import type { DatabaseService } from '../database/database.service.js';

// Internal row shape (includes the system-managed `version` and `created_at`,
// which are not part of the client-facing Project DTO).
export interface ProjectRow {
  id: string;
  name: string;
  version: number;
  created_at: string;
}

export type RepositoryStatus = 'connected' | 'disconnected';

// `id` is GitHub's immutable numeric repository id (as string); `full_name`
// is display metadata refreshed on access checks (decision 48).
export interface RepositoryRow {
  id: string;
  full_name: string;
  private: boolean;
  status: RepositoryStatus;
  status_changed_at: string;
  version: number;
  created_at: string;
}

export interface RepositoryInput {
  id: string;
  fullName: string;
  private: boolean;
}

export interface ProjectSummaryRow extends ProjectRow {
  installation_id: string | null;
  repository_count: number;
  disconnected_count: number;
}

// lbug returns INT64 columns as `bigint`; normalize at the repository edge.
interface RawProjectRow {
  id: string;
  name: string;
  version: number | bigint;
  created_at: string;
}

interface RawRepositoryRow extends Omit<RepositoryRow, 'version' | 'status'> {
  status: string;
  version: number | bigint;
}

const RETURN_PROJECT = `RETURN p.id AS id, p.name AS name, p.version AS version, p.created_at AS created_at`;

const RETURN_REPOSITORY = `RETURN r.id AS id, r.full_name AS full_name, r.private AS private,
         r.status AS status, r.status_changed_at AS status_changed_at,
         r.version AS version, r.created_at AS created_at`;

/**
 * Every graph read and write behind projects and their repository
 * connections. The invariants — unique name, one repository per project, ≥1
 * repository per project — are conditional writes here (the
 * `claimOwnerAccount` pattern), never read-then-write; services above turn a
 * refused write into the explainable error the routes owe the UI.
 */
export class ProjectsRepository {
  private readonly db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  // --- projects ---------------------------------------------------------

  /**
   * The server mints the id (UUIDv7) — all clients use it (OQ-2.2). Guarded
   * by name uniqueness: `null` back means the name is taken, and the caller
   * fetches the owner via `findByName` for the refusal payload.
   */
  async create(name: string): Promise<ProjectRow | null> {
    const id = newUuid();
    const createdAt = new Date().toISOString();
    const rows = await this.db.query<RawProjectRow>(
      `OPTIONAL MATCH (existing:Project {name: $name})
       WITH count(existing) AS taken
       WHERE taken = 0
       CREATE (p:Project {id: $id, name: $name, version: 0, created_at: $createdAt})
       ${RETURN_PROJECT}`,
      { id, name, createdAt },
    );
    return rows[0] ? toProjectRow(rows[0]) : null;
  }

  async findById(id: string): Promise<ProjectRow | null> {
    const rows = await this.db.query<RawProjectRow>(
      `MATCH (p:Project {id: $id}) ${RETURN_PROJECT}`,
      { id },
    );
    const row = rows[0];
    return row ? toProjectRow(row) : null;
  }

  async findByName(name: string): Promise<ProjectRow | null> {
    const rows = await this.db.query<RawProjectRow>(
      `MATCH (p:Project {name: $name}) ${RETURN_PROJECT}`,
      { name },
    );
    const row = rows[0];
    return row ? toProjectRow(row) : null;
  }

  /** Projects with their installation and connection-health summary, no GitHub round-trip. */
  async list(): Promise<ProjectSummaryRow[]> {
    interface Raw extends RawProjectRow {
      installation_id: string | null;
      repository_count: number | bigint;
      disconnected_count: number | bigint;
    }
    const rows = await this.db.query<Raw>(
      `MATCH (p:Project)
       OPTIONAL MATCH (p)-[:UsesInstallation]->(i:GhInstallation)
       OPTIONAL MATCH (p)-[:Tracks]->(r:Repository)
       WITH p, i, count(r) AS repository_count,
            sum(CASE WHEN r.status = 'disconnected' THEN 1 ELSE 0 END)
              AS disconnected_count
       RETURN p.id AS id, p.name AS name, p.version AS version,
              p.created_at AS created_at, i.id AS installation_id,
              repository_count, disconnected_count
       ORDER BY p.name`,
    );
    return rows.map((row) => ({
      ...toProjectRow(row),
      installation_id: row.installation_id,
      repository_count: Number(row.repository_count),
      disconnected_count: Number(row.disconnected_count ?? 0),
    }));
  }

  /**
   * Optimistic-concurrency reference implementation (OQ-2.3), now also under
   * the unique-name guard. Zero rows back is disambiguated in order: missing
   * project, name taken by another project, then version conflict.
   */
  async rename(
    id: string,
    name: string,
    expectedVersion: number,
  ): Promise<ProjectRow> {
    const rows = await this.db.query<RawProjectRow>(
      `MATCH (p:Project {id: $id})
       WHERE p.version = $expectedVersion
       OPTIONAL MATCH (other:Project {name: $name}) WHERE other.id <> $id
       WITH p, count(other) AS taken
       WHERE taken = 0
       SET p.name = $name, p.version = p.version + 1
       ${RETURN_PROJECT}`,
      { id, name, expectedVersion },
    );
    const row = rows[0];
    if (row) {
      return toProjectRow(row);
    }
    const current = await this.findById(id);
    if (current === null) {
      throw new Error(`Project ${id} not found`);
    }
    const holder = await this.findByName(name);
    if (holder !== null && holder.id !== id) {
      throw new DuplicateProjectNameError(holder);
    }
    throw new ConcurrencyConflictError('Project', id);
  }

  /**
   * Hard delete (resolved deletion question): the project and its Repository
   * nodes go together — exclusivity means no other project can reach them.
   * Returns false when the project does not exist.
   */
  async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (existing === null) return false;
    await this.db.query(
      `MATCH (:Project {id: $id})-[:Tracks]->(r:Repository) DETACH DELETE r`,
      { id },
    );
    // Inbox items exist only under their project (same exclusivity argument
    // as Repository nodes), so they go with it.
    await this.db.query(
      `MATCH (:Project {id: $id})-[:HasInboxItem]->(i:InboxItem) DETACH DELETE i`,
      { id },
    );
    await this.db.query(`MATCH (p:Project {id: $id}) DETACH DELETE p`, { id });
    return true;
  }

  // --- installation binding --------------------------------------------

  /** A project binds to exactly one installation (decision 46) — set at create, never moved. */
  async setInstallation(
    projectId: string,
    installationId: string,
  ): Promise<void> {
    await this.db.query(
      `MATCH (p:Project {id: $projectId}), (i:GhInstallation {id: $installationId})
       MERGE (p)-[:UsesInstallation]->(i)`,
      { projectId, installationId },
    );
  }

  async findInstallationId(projectId: string): Promise<string | null> {
    const rows = await this.db.query<{ id: string }>(
      `MATCH (:Project {id: $projectId})-[:UsesInstallation]->(i:GhInstallation)
       RETURN i.id AS id`,
      { projectId },
    );
    return rows[0]?.id ?? null;
  }

  // --- repositories -----------------------------------------------------

  /**
   * The exclusivity write: creates the Repository node and its edges only
   * while no project tracks that repository id. `null` back means refused —
   * the caller asks `findOwningProject` for the 409 payload. The node is
   * created fresh (never merged) because detach deletes it: a repository
   * reconnected elsewhere is a new node with a clean status history.
   */
  async attachRepository(
    projectId: string,
    repo: RepositoryInput,
  ): Promise<RepositoryRow | null> {
    const createdAt = new Date().toISOString();
    const rows = await this.db.query<RawRepositoryRow>(
      `MATCH (p:Project {id: $projectId})-[:UsesInstallation]->(i:GhInstallation)
       OPTIONAL MATCH (:Project)-[t:Tracks]->(:Repository {id: $repoId})
       WITH p, i, count(t) AS owners
       WHERE owners = 0
       CREATE (r:Repository {
         id: $repoId, full_name: $fullName, private: $isPrivate,
         status: 'connected', status_changed_at: $createdAt,
         version: 0, created_at: $createdAt
       })
       CREATE (p)-[:Tracks]->(r)
       CREATE (r)-[:InInstallation]->(i)
       ${RETURN_REPOSITORY}`,
      {
        projectId,
        repoId: repo.id,
        fullName: repo.fullName,
        isPrivate: repo.private,
        createdAt,
      },
    );
    const row = rows[0];
    return row ? toRepositoryRow(row) : null;
  }

  /**
   * The ≥1-repository guard: deletes the connection (and the node — see
   * `attachRepository`) only while another repository remains tracked. Zero
   * deletions are disambiguated by the caller via `listRepositories`.
   */
  async detachRepository(projectId: string, repoId: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      `MATCH (p:Project {id: $projectId})-[:Tracks]->(r:Repository {id: $repoId})
       MATCH (p)-[t:Tracks]->(:Repository)
       WITH r, count(t) AS tracked
       WHERE tracked > 1
       WITH r, r.id AS id
       DETACH DELETE r
       RETURN id`,
      { projectId, repoId },
    );
    return rows.length > 0;
  }

  async listRepositories(projectId: string): Promise<RepositoryRow[]> {
    const rows = await this.db.query<RawRepositoryRow>(
      `MATCH (:Project {id: $projectId})-[:Tracks]->(r:Repository)
       ${RETURN_REPOSITORY}
       ORDER BY r.full_name`,
      { projectId },
    );
    return rows.map(toRepositoryRow);
  }

  /** Who owns a repository id — the 409 payload for refused attaches, and the picker annotation. */
  async findOwningProject(repoId: string): Promise<ProjectRow | null> {
    const rows = await this.db.query<RawProjectRow>(
      `MATCH (p:Project)-[:Tracks]->(:Repository {id: $repoId})
       ${RETURN_PROJECT}`,
      { repoId },
    );
    const row = rows[0];
    return row ? toProjectRow(row) : null;
  }

  // --- access-check writes ----------------------------------------------

  /**
   * Status flip, stamped only when it actually flips — so
   * `status_changed_at` answers "disconnected since when", not "last
   * checked when". Metadata refresh is `refreshRepositoryMetadata`.
   */
  async setRepositoryStatus(
    repoId: string,
    status: RepositoryStatus,
    changedAt: string,
  ): Promise<void> {
    await this.db.query(
      `MATCH (r:Repository {id: $repoId})
       WHERE r.status <> $status
       SET r.status = $status, r.status_changed_at = $changedAt,
           r.version = r.version + 1`,
      { repoId, status, changedAt },
    );
  }

  /** Rename/transfer follow-through: `owner/name` and visibility track GitHub. */
  async refreshRepositoryMetadata(
    repoId: string,
    fullName: string,
    isPrivate: boolean,
  ): Promise<void> {
    await this.db.query(
      `MATCH (r:Repository {id: $repoId})
       WHERE r.full_name <> $fullName OR r.private <> $isPrivate
       SET r.full_name = $fullName, r.private = $isPrivate,
           r.version = r.version + 1`,
      { repoId, fullName, isPrivate },
    );
  }
}

/** The name is taken; carries the holder so the refusal can identify it. */
export class DuplicateProjectNameError extends Error {
  readonly existing: ProjectRow;

  constructor(existing: ProjectRow) {
    super(`Project name "${existing.name}" is already in use.`);
    this.name = 'DuplicateProjectNameError';
    this.existing = existing;
  }
}

function toProjectRow(raw: RawProjectRow): ProjectRow {
  return {
    id: raw.id,
    name: raw.name,
    version: Number(raw.version),
    created_at: raw.created_at,
  };
}

function toRepositoryRow(raw: RawRepositoryRow): RepositoryRow {
  return {
    ...raw,
    status: raw.status === 'connected' ? 'connected' : 'disconnected',
    version: Number(raw.version),
  };
}
