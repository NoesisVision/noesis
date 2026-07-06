import type { Project } from '@repo/shared-contracts';
import type { ProjectRow, ProjectsRepository } from './projects.repository.js';

export class ProjectsService {
  private readonly projects: ProjectsRepository;

  constructor(projects: ProjectsRepository) {
    this.projects = projects;
  }

  // The server owns the project id (UUIDv7); clients receive it and use it on
  // every subsequent call (OQ-2.2). Project resolution from the *authenticated*
  // caller is wired in with auth (Part 7); for now this is the create/lookup
  // surface those layers build on.
  async create(name: string): Promise<Project> {
    return toProject(await this.projects.create(name));
  }

  async findById(id: string): Promise<Project | null> {
    const row = await this.projects.findById(id);
    return row ? toProject(row) : null;
  }

  async rename(
    id: string,
    name: string,
    expectedVersion: number,
  ): Promise<Project> {
    return toProject(await this.projects.rename(id, name, expectedVersion));
  }
}

function toProject(row: ProjectRow): Project {
  return { id: row.id, name: row.name };
}
