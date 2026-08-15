import type { GithubAuthModule } from '../../auth/auth.module.js';
import type { GhRepositorySummary } from '../../auth/github.service.js';

/**
 * The reachable set for one of the acting user's installations — the shared
 * ground truth for the picker and for validating attaches. The installation
 * must be one the account has linked: repository ids in a request are claims,
 * and this is where they get checked against something the server trusts.
 */
export async function reachableRepositories(
  module: GithubAuthModule,
  accountId: string,
  installationId: string,
): Promise<GhRepositorySummary[] | 'unknown_installation'> {
  const installations = await module.auth.listInstallations(accountId);
  if (!installations.some((i) => i.id === installationId)) {
    return 'unknown_installation';
  }
  const token = await module.ghTokens.getAccessToken(accountId);
  return module.github.listInstallationRepositories(token, installationId);
}
