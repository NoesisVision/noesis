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

// lbug returns INT64 columns as `bigint`; normalize at the repository edge.
interface RawProjectRow {
  id: string;
  name: string;
  version: number | bigint;
  created_at: string;
}

const RETURN_PROJECT = `RETURN p.id AS id, p.name AS name, p.version AS version, p.created_at AS created_at`;

export class ProjectsRepository {
  private readonly db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  // The server mints the id (UUIDv7) — all clients use it (OQ-2.2).
  async create(name: string): Promise<ProjectRow> {
    const id = newUuid();
    const createdAt = new Date().toISOString();
    await this.db.query(
      `CREATE (p:Project {id: $id, name: $name, version: 0, created_at: $createdAt})`,
      { id, name, createdAt },
    );
    return { id, name, version: 0, created_at: createdAt };
  }

  async findById(id: string): Promise<ProjectRow | null> {
    const rows = await this.db.query<RawProjectRow>(
      `MATCH (p:Project {id: $id}) ${RETURN_PROJECT}`,
      { id },
    );
    const row = rows[0];
    return row ? toProjectRow(row) : null;
  }

  // Optimistic-concurrency reference implementation (OQ-2.3): the canonical
  // mutating pattern every later repository follows — match on the expected
  // version, increment it, and treat "no row updated" as a conflict.
  async rename(
    id: string,
    name: string,
    expectedVersion: number,
  ): Promise<ProjectRow> {
    const rows = await this.db.query<RawProjectRow>(
      `MATCH (p:Project {id: $id})
       WHERE p.version = $expectedVersion
       SET p.name = $name, p.version = p.version + 1
       ${RETURN_PROJECT}`,
      { id, name, expectedVersion },
    );
    const row = rows[0];
    if (row) {
      return toProjectRow(row);
    }
    // No row matched: the project is gone, or another writer bumped the version.
    const current = await this.findById(id);
    if (current === null) {
      throw new Error(`Project ${id} not found`);
    }
    throw new ConcurrencyConflictError('Project', id);
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
