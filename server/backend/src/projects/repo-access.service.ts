import type { Octokit } from 'octokit';
import type { GhAppService } from '../auth/gh-app.service.js';
import type {
  ProjectsRepository,
  RepositoryRow,
} from './projects.repository.js';

export interface AccessCheckResult {
  /** False when GitHub was unreachable and stored state was served unchanged. */
  healthChecked: boolean;
  repositories: RepositoryRow[];
}

/**
 * The on-demand access check (projects.md §3, resolved freshness question):
 * refreshes a project's stored connection state against what the App can
 * actually reach, when a project is viewed or an attach is attempted. Health
 * means "the App has access", not "you have access" (resolved visibility
 * question) — hence the installation token, no user in sight.
 */
export class RepoAccessService {
  private readonly projects: ProjectsRepository;
  private readonly ghApp: GhAppService;
  private readonly now: () => Date;

  constructor(
    projects: ProjectsRepository,
    ghApp: GhAppService,
    now: () => Date = () => new Date(),
  ) {
    this.projects = projects;
    this.ghApp = ghApp;
    this.now = now;
  }

  /**
   * Reconciles one project and returns its fresh repository rows. Never
   * throws for GitHub-side trouble: an unreachable GitHub serves stored
   * state flagged `healthChecked: false` — the check must not make the
   * project page unavailable.
   */
  async checkProject(projectId: string): Promise<AccessCheckResult> {
    const tracked = await this.projects.listRepositories(projectId);
    if (tracked.length === 0) {
      return { healthChecked: true, repositories: tracked };
    }
    const installationId = await this.projects.findInstallationId(projectId);
    if (installationId === null) {
      // No installation bound — nothing to check against; stored state stands.
      return { healthChecked: false, repositories: tracked };
    }

    let reachable: Map<string, { fullName: string; private: boolean }>;
    try {
      reachable = await this.listReachable(
        this.ghApp.installationOctokit(installationId),
      );
    } catch (error) {
      if (isInstallationGone(error)) {
        // Uninstalled or suspended: every tracked repository is dead, and
        // that is a definite answer, not an outage.
        const at = this.now().toISOString();
        for (const repository of tracked) {
          await this.projects.setRepositoryStatus(
            repository.id,
            'disconnected',
            at,
          );
        }
        return {
          healthChecked: true,
          repositories: await this.projects.listRepositories(projectId),
        };
      }
      return { healthChecked: false, repositories: tracked };
    }

    const at = this.now().toISOString();
    for (const repository of tracked) {
      const seen = reachable.get(repository.id);
      if (seen === undefined) {
        await this.projects.setRepositoryStatus(
          repository.id,
          'disconnected',
          at,
        );
      } else {
        await this.projects.setRepositoryStatus(repository.id, 'connected', at);
        await this.projects.refreshRepositoryMetadata(
          repository.id,
          seen.fullName,
          seen.private,
        );
      }
    }
    return {
      healthChecked: true,
      repositories: await this.projects.listRepositories(projectId),
    };
  }

  /** Everything the installation token reaches — the ground truth, paginated by hand (see GithubService). */
  private async listReachable(
    octokit: Octokit,
  ): Promise<Map<string, { fullName: string; private: boolean }>> {
    const reachable = new Map<string, { fullName: string; private: boolean }>();
    const perPage = 100;
    for (let page = 1; ; page += 1) {
      const { data } =
        await octokit.rest.apps.listReposAccessibleToInstallation({
          per_page: perPage,
          page,
        });
      for (const repository of data.repositories) {
        reachable.set(String(repository.id), {
          fullName: repository.full_name,
          private: repository.private,
        });
      }
      if (data.repositories.length < perPage) return reachable;
    }
  }
}

// 404 (uninstalled) and 403 (suspended) are GitHub's definite "no access"
// answers; anything else — network failure, 5xx — is an outage to ride out.
function isInstallationGone(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  return status === 404 || status === 403;
}
