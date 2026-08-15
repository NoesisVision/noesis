import type {
  AccountRow,
  AuthRepository,
  GhProfile,
  InstallationRow,
  InviteRow,
} from './auth.repository.js';
import { encryptSecret } from './crypto.js';
import type { GhInstallationSummary, GithubService } from './github.service.js';
import type { SessionService } from './session.service.js';

/** What a client is ever told about an account. `role` is the only field the ui gates on. */
export interface AccountDto {
  id: string;
  login: string;
  name: string;
  avatarUrl: string;
  role: 'owner' | 'member';
}

export interface InstallationDto {
  id: string;
  accountLogin: string;
  accountType: string;
  repositorySelection: string;
  /** Where an admin changes which repositories this installation may touch. */
  manageUrl: string;
}

export interface InviteDto {
  id: string;
  ghLogin: string;
  invitedBy: string;
  createdAt: string;
  acceptedAt: string | null;
}

export type SignInResult =
  | { ok: true; account: AccountRow; token: string }
  | { ok: false; reason: 'not_invited'; login: string };

/**
 * The account every request runs as when `NOESIS_AUTH_MODE=disabled`. It is
 * never written to the graph — it exists so the guard, `/ui/me` and the owner
 * check have something coherent to answer with while no GitHub App is
 * registered.
 */
export const LOCAL_ACCOUNT: AccountRow = {
  id: 'local-owner',
  gh_user_id: 0,
  login: 'local',
  name: 'Local development',
  avatar_url: '',
  email: '',
  role: 'owner',
  version: 0,
  created_at: '1970-01-01T00:00:00.000Z',
};

/**
 * Sign-in, admission and the account-facing reads behind `/ui/me` and
 * `/ui/invites`. It owns the *rules*; `AuthRepository` owns the Cypher and
 * `GithubService` the outbound HTTP.
 */
export class AuthService {
  private readonly repo: AuthRepository;
  private readonly sessions: SessionService;
  private readonly github: GithubService;
  private readonly tokenKey: Buffer;

  constructor(
    repo: AuthRepository,
    sessions: SessionService,
    github: GithubService,
    tokenKey: Buffer,
  ) {
    this.repo = repo;
    this.sessions = sessions;
    this.github = github;
    this.tokenKey = tokenKey;
  }

  /**
   * The whole callback, minus the HTTP: exchange the code, apply the admission
   * rule, then — and only then — write anything. A rejected login leaves the
   * graph exactly as it found it.
   */
  async signInWithCode(
    code: string,
    previousToken?: string,
  ): Promise<SignInResult> {
    const tokens = await this.github.exchangeCode(code);
    const profile = await this.github.fetchProfile(tokens.accessToken);

    const admitted = await this.admit(profile);
    if (admitted === null) {
      return { ok: false, reason: 'not_invited', login: profile.login };
    }

    await this.repo.replaceCredential(admitted.id, {
      accessTokenEnc: encryptSecret(tokens.accessToken, this.tokenKey),
      accessExpiresAt: tokens.accessExpiresAt,
      refreshTokenEnc: encryptSecret(tokens.refreshToken, this.tokenKey),
      refreshExpiresAt: tokens.refreshExpiresAt,
    });
    await this.syncInstallations(admitted.id, tokens.accessToken);

    const token = await this.sessions.rotate(previousToken, admitted.id);
    return { ok: true, account: admitted, token };
  }

  /**
   * §6's admission rule, in order. Returns `null` for "this deployment does not
   * want this person", which is the only branch that writes nothing at all.
   */
  private async admit(profile: GhProfile): Promise<AccountRow | null> {
    const existing = await this.repo.findAccountByGhUserId(profile.ghUserId);
    if (existing !== null) {
      return this.repo.updateAccountProfile(existing.id, profile);
    }

    // A conditional write, not a read-then-write: whichever of two
    // simultaneous first logins loses simply falls through to the invite
    // branch (and is rejected there), rather than becoming a second owner.
    const owner = await this.repo.claimOwnerAccount(profile);
    if (owner !== null) return owner;

    const invite = await this.repo.findPendingInvite(profile.login);
    if (invite === null) return null;
    // Consuming the invite is itself conditional, so one invite admits one
    // account even if the same person opens two callback tabs.
    const consumed = await this.repo.acceptInvite(
      invite.id,
      new Date().toISOString(),
    );
    if (!consumed) return null;

    return this.repo.createAccount(profile, 'member');
  }

  async signOut(token: string, accountId: string): Promise<void> {
    await this.sessions.revoke(token);
    // The GitHub grant is deliberately left alone: logging out of Noesis is
    // not a revocation of the App's access, and revoking here would force a
    // re-authorization screen on the user's next sign-in.
    void accountId;
  }

  async accountDto(account: AccountRow): Promise<AccountDto> {
    return toAccountDto(account);
  }

  async listInstallations(accountId: string): Promise<InstallationDto[]> {
    const rows = await this.repo.listInstallations(accountId);
    return rows.map(toInstallationDto);
  }

  /**
   * Mirrors GitHub's answer rather than merging into it: an installation the
   * user lost access to must stop being listed, and GitHub is authoritative.
   * Best-effort — a GitHub hiccup here must not fail a sign-in.
   */
  async syncInstallations(
    accountId: string,
    accessToken: string,
  ): Promise<void> {
    try {
      const installations = await this.github.listInstallations(accessToken);
      await this.repo.replaceInstallations(
        accountId,
        installations.map(toInstallationColumns),
      );
    } catch (error) {
      console.warn(
        `[auth] could not sync installations for ${accountId}: ${String(error)}`,
      );
    }
  }

  async linkInstallation(
    accountId: string,
    accessToken: string,
    installationId: string,
  ): Promise<boolean> {
    const installation = await this.github.fetchInstallation(
      accessToken,
      installationId,
    );
    // GitHub sends the browser here after the install screen, but only the
    // App's own API can confirm the installation is real and visible to this
    // user — an `installation_id` in a query string proves nothing.
    if (installation === null) return false;
    await this.repo.linkInstallation(
      accountId,
      toInstallationColumns(installation),
    );
    return true;
  }

  // --- invites ----------------------------------------------------------

  async listInvites(): Promise<InviteDto[]> {
    return (await this.repo.listInvites()).map(toInviteDto);
  }

  async invite(ghLogin: string, invitedBy: AccountRow): Promise<InviteDto> {
    const normalized = ghLogin.trim();
    const pending = await this.repo.findPendingInvite(normalized);
    // Inviting the same login twice is a no-op rather than an error: the owner
    // asked for a state, and that state already holds.
    if (pending !== null) return toInviteDto(pending);
    return toInviteDto(
      await this.repo.createInvite(normalized, invitedBy.login),
    );
  }

  async revokeInvite(id: string): Promise<boolean> {
    return this.repo.deleteInvite(id);
  }
}

export function toAccountDto(account: AccountRow): AccountDto {
  return {
    id: account.id,
    login: account.login,
    name: account.name,
    avatarUrl: account.avatar_url,
    role: account.role,
  };
}

function toInstallationColumns(
  installation: GhInstallationSummary,
): Omit<InstallationRow, 'created_at'> {
  return {
    id: installation.id,
    account_login: installation.accountLogin,
    account_type: installation.accountType,
    repository_selection: installation.repositorySelection,
  };
}

function toInstallationDto(row: InstallationRow): InstallationDto {
  return {
    id: row.id,
    accountLogin: row.account_login,
    accountType: row.account_type,
    repositorySelection: row.repository_selection,
    // Repository selection happens on two screens with different authority
    // (§5): GitHub's, where an admin decides what the App may touch at all,
    // and ours, which picks a subset. Noesis can only deep-link to the first.
    manageUrl:
      row.account_type === 'Organization'
        ? `https://github.com/organizations/${row.account_login}/settings/installations/${row.id}`
        : `https://github.com/settings/installations/${row.id}`,
  };
}

function toInviteDto(row: InviteRow): InviteDto {
  return {
    id: row.id,
    ghLogin: row.gh_login,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
  };
}
