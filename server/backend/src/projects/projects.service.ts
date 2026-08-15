import type { Project } from '@repo/shared-contracts';
import {
  DuplicateProjectNameError,
  type ProjectRow,
  type ProjectSummaryRow,
  type ProjectsRepository,
  type RepositoryInput,
  type RepositoryRow,
} from './projects.repository.js';

export interface ProjectSummary extends Project {
  installationId: string | null;
  repositoryCount: number;
  disconnectedCount: number;
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project ${id} not found`);
    this.name = 'ProjectNotFoundError';
  }
}

/** The exclusivity refusal: carries the owner so the 409 can identify it. */
export class RepositoryOwnedError extends Error {
  readonly repositoryId: string;
  readonly owningProject: Project;

  constructor(repositoryId: string, owner: ProjectRow) {
    super(
      `Repository ${repositoryId} already belongs to project "${owner.name}".`,
    );
    this.name = 'RepositoryOwnedError';
    this.repositoryId = repositoryId;
    this.owningProject = { id: owner.id, name: owner.name };
  }
}

/** The ≥1-repository refusal: detach denied, deletion is the way out. */
export class LastRepositoryError extends Error {
  constructor() {
    super(
      'A project cannot lose its last repository; delete the project instead.',
    );
    this.name = 'LastRepositoryError';
  }
}

/**
 * The project rules over the guarded writes in ProjectsRepository: every
 * refused write becomes a typed error the routes translate into the
 * explainable 409s the job stories demand. GitHub-facing concerns (the
 * picker listing, the access check) live next door — this class never talks
 * to GitHub.
 */
export class ProjectsService {
  private readonly projects: ProjectsRepository;

  constructor(projects: ProjectsRepository) {
    this.projects = projects;
  }

  // The server owns the project id (UUIDv7); clients receive it and use it on
  // every subsequent call (OQ-2.2).
  async create(name: string): Promise<Project> {
    const row = await this.projects.create(name);
    if (row === null) {
      const existing = await this.projects.findByName(name);
      if (existing === null) {
        // The guarded create refused but the name is free again: a concurrent
        // delete won the race. Rare enough to surface as a retryable error.
        throw new Error(`Project creation for "${name}" lost a race; retry.`);
      }
      throw new DuplicateProjectNameError(existing);
    }
    return toProject(row);
  }

  /**
   * The elicited create-in-one-sitting: project + installation + ≥1
   * repository. Create-then-attach across statements, so a refused attach
   * deletes the just-created project again — a failed create never leaves an
   * empty shell.
   */
  async createWithRepositories(
    name: string,
    installationId: string,
    repositories: readonly RepositoryInput[],
  ): Promise<Project> {
    if (repositories.length === 0) {
      throw new Error('A project needs at least one repository.');
    }
    const project = await this.create(name);
    await this.projects.setInstallation(project.id, installationId);
    for (const input of repositories) {
      try {
        await this.attachTo(project.id, input);
      } catch (error) {
        await this.projects.delete(project.id);
        throw error;
      }
    }
    return project;
  }

  async list(): Promise<ProjectSummary[]> {
    return (await this.projects.list()).map(toSummary);
  }

  async findById(id: string): Promise<Project | null> {
    const row = await this.projects.findById(id);
    return row ? toProject(row) : null;
  }

  async findInstallationId(projectId: string): Promise<string | null> {
    return this.projects.findInstallationId(projectId);
  }

  async listRepositories(projectId: string): Promise<RepositoryRow[]> {
    return this.projects.listRepositories(projectId);
  }

  async findOwningProject(repositoryId: string): Promise<Project | null> {
    const row = await this.projects.findOwningProject(repositoryId);
    return row ? toProject(row) : null;
  }

  async rename(
    id: string,
    name: string,
    expectedVersion: number,
  ): Promise<Project> {
    return toProject(await this.projects.rename(id, name, expectedVersion));
  }

  /** Hard delete (resolved deletion question); the typed-name confirmation is the UI's. */
  async delete(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  async attachRepository(
    projectId: string,
    input: RepositoryInput,
  ): Promise<RepositoryRow> {
    if ((await this.projects.findById(projectId)) === null) {
      throw new ProjectNotFoundError(projectId);
    }
    return this.attachTo(projectId, input);
  }

  async detachRepository(projectId: string, repoId: string): Promise<void> {
    if (await this.projects.detachRepository(projectId, repoId)) return;
    // The guarded delete refused; say why.
    const tracked = await this.projects.listRepositories(projectId);
    if (tracked.some((r) => r.id === repoId)) {
      throw new LastRepositoryError();
    }
    throw new ProjectNotFoundError(projectId);
  }

  private async attachTo(
    projectId: string,
    input: RepositoryInput,
  ): Promise<RepositoryRow> {
    const attached = await this.projects.attachRepository(projectId, input);
    if (attached !== null) return attached;
    const owner = await this.projects.findOwningProject(input.id);
    if (owner !== null) {
      throw new RepositoryOwnedError(input.id, owner);
    }
    // No owner and still refused: the project has no installation bound (or
    // vanished mid-flight) — a caller bug, not a user-explainable conflict.
    throw new Error(
      `Attach of ${input.id} to ${projectId} refused: no installation bound.`,
    );
  }
}

function toProject(row: ProjectRow): Project {
  return { id: row.id, name: row.name };
}

function toSummary(row: ProjectSummaryRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    installationId: row.installation_id,
    repositoryCount: row.repository_count,
    disconnectedCount: row.disconnected_count,
  };
}
