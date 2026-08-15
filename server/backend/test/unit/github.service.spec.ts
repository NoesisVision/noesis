import { describe, expect, it } from 'bun:test';
import { GithubService } from '../../src/auth/github.service.js';
import { createFakeGithub, testAuthConfig } from './github-fake.js';

// Only the repository-listing surface gets its own spec here — the OAuth flow
// is exercised end to end by the auth route/session specs.

describe('GithubService.listInstallationRepositories', () => {
  it('lists and normalizes the repositories of one installation', async () => {
    const fake = createFakeGithub({
      installations: [
        {
          id: 7,
          account: { login: 'acme', type: 'Organization' },
          repository_selection: 'selected',
        },
      ],
      repositories: {
        7: [
          { id: 1001, full_name: 'acme/api', private: true },
          { id: 1002, full_name: 'acme/web', private: false },
        ],
      },
    });
    const github = new GithubService(testAuthConfig(), fake.fetch);

    const repos = await github.listInstallationRepositories('access-1', '7');
    expect(repos).toEqual([
      { id: '1001', fullName: 'acme/api', private: true },
      { id: '1002', fullName: 'acme/web', private: false },
    ]);
    expect(fake.calls).toContain('GET /user/installations/7/repositories');
  });

  it('walks past the first page', async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: 2000 + i,
      full_name: `acme/repo-${i}`,
      private: false,
    }));
    const fake = createFakeGithub({ repositories: { 7: many } });
    const github = new GithubService(testAuthConfig(), fake.fetch);

    const repos = await github.listInstallationRepositories('access-1', '7');
    expect(repos).toHaveLength(150);
    expect(repos[149]?.fullName).toBe('acme/repo-149');
  });

  it('answers empty for an installation with no repositories', async () => {
    const fake = createFakeGithub();
    const github = new GithubService(testAuthConfig(), fake.fetch);
    expect(await github.listInstallationRepositories('access-1', '7')).toEqual(
      [],
    );
  });
});
