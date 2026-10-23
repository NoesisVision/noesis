import { Hono } from 'hono';

export interface ProjectDeps {
  /** The repository's folder name, as the scanners name its system model. */
  projectName: string;
}

/**
 * Mounted at `/ui/project`. Which project the server was started on, for the
 * page to name it beside its own.
 */
export function createProjectApp(deps: ProjectDeps) {
  const { projectName } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono().get('/', (c) => c.json({ project: { name: projectName } }));
}
