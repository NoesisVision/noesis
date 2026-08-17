import { newUuid } from '@repo/shared-contracts/uuid';
import { ConcurrencyConflictError } from '../database/concurrency.js';
import type { DatabaseService } from '../database/database.service.js';

export type AccountRole = 'owner' | 'member';

// Internal row shapes: they carry the system-managed `version`/`created_at`
// columns, which never reach a client DTO.
export interface AccountRow {
  id: string;
  gh_user_id: number;
  login: string;
  name: string;
  avatar_url: string;
  email: string;
  role: AccountRole;
  version: number;
  created_at: string;
}

export interface SessionRow {
  id: string;
  created_at: string;
  expires_at: string;
}

export interface CredentialRow {
  id: string;
  access_token_enc: string;
  access_expires_at: string;
  refresh_token_enc: string;
  refresh_expires_at: string;
  version: number;
}

export interface InstallationRow {
  id: string;
  account_login: string;
  account_type: string;
  repository_selection: string;
  created_at: string;
}

export interface InviteRow {
  id: string;
  gh_login: string;
  invited_by: string;
  created_at: string;
  accepted_at: string | null;
}

export interface GhProfile {
  ghUserId: number;
  login: string;
  name: string;
  avatarUrl: string;
  email: string;
}

export interface CredentialInput {
  accessTokenEnc: string;
  accessExpiresAt: string;
  refreshTokenEnc: string;
  refreshExpiresAt: string;
}

// lbug returns INT64 columns as `bigint`; normalize at the repository edge, as
// ProjectsRepository does.
interface RawAccountRow extends Omit<AccountRow, 'gh_user_id' | 'version'> {
  gh_user_id: number | bigint;
  version: number | bigint;
}

const RETURN_ACCOUNT = `RETURN a.id AS id, a.gh_user_id AS gh_user_id, a.login AS login,
         a.name AS name, a.avatar_url AS avatar_url, a.email AS email,
         a.role AS role, a.version AS version, a.created_at AS created_at`;

const ACCOUNT_PROPS = `{
     id: $id, gh_user_id: $ghUserId, login: $login, name: $name,
     avatar_url: $avatarUrl, email: $email, role: $role,
     version: 0, created_at: $createdAt
   }`;

/**
 * Every graph read and write behind sign-in: accounts, sessions, credentials,
 * installations and invites. Services above it hold the rules; this holds the
 * Cypher.
 */
export class AuthRepository {
  private readonly db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  // --- accounts ---------------------------------------------------------

  async findAccountById(id: string): Promise<AccountRow | null> {
    const rows = await this.db.query<RawAccountRow>(
      `MATCH (a:Account {id: $id}) ${RETURN_ACCOUNT}`,
      { id },
    );
    return rows[0] ? toAccountRow(rows[0]) : null;
  }

  async findAccountByGhUserId(ghUserId: number): Promise<AccountRow | null> {
    const rows = await this.db.query<RawAccountRow>(
      `MATCH (a:Account {gh_user_id: $ghUserId}) ${RETURN_ACCOUNT}`,
      { ghUserId: BigInt(ghUserId) },
    );
    return rows[0] ? toAccountRow(rows[0]) : null;
  }

  /**
   * The ownership claim: a single conditional write guarded by the account
   * count, never a read-then-write. Two simultaneous first logins therefore
   * cannot both win — the loser gets `null` back and falls through to the
   * invite branch of the admission rule.
   */
  async claimOwnerAccount(profile: GhProfile): Promise<AccountRow | null> {
    const rows = await this.db.query<RawAccountRow>(
      `MATCH (existing:Account) WITH count(existing) AS accounts
       WHERE accounts = 0
       CREATE (a:Account ${ACCOUNT_PROPS})
       ${RETURN_ACCOUNT}`,
      accountParams(profile, 'owner'),
    );
    return rows[0] ? toAccountRow(rows[0]) : null;
  }

  async createAccount(
    profile: GhProfile,
    role: AccountRole,
  ): Promise<AccountRow> {
    const params = accountParams(profile, role);
    const rows = await this.db.query<RawAccountRow>(
      `CREATE (a:Account ${ACCOUNT_PROPS}) ${RETURN_ACCOUNT}`,
      params,
    );
    const row = rows[0];
    if (!row) throw new Error('Account creation returned no row');
    return toAccountRow(row);
  }

  /** Keeps the cached profile fresh on every sign-in; the role is never touched here. */
  async updateAccountProfile(
    id: string,
    profile: GhProfile,
  ): Promise<AccountRow> {
    const rows = await this.db.query<RawAccountRow>(
      `MATCH (a:Account {id: $id})
       SET a.login = $login, a.name = $name, a.avatar_url = $avatarUrl,
           a.email = $email, a.version = a.version + 1
       ${RETURN_ACCOUNT}`,
      {
        id,
        login: profile.login,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        email: profile.email,
      },
    );
    const row = rows[0];
    if (!row) throw new Error(`Account ${id} not found`);
    return toAccountRow(row);
  }

  async listAccounts(): Promise<AccountRow[]> {
    const rows = await this.db.query<RawAccountRow>(
      `MATCH (a:Account) ${RETURN_ACCOUNT} ORDER BY a.login`,
    );
    return rows.map(toAccountRow);
  }

  async countAccounts(): Promise<number> {
    const rows = await this.db.query<{ n: number | bigint }>(
      `MATCH (a:Account) RETURN count(a) AS n`,
    );
    return Number(rows[0]?.n ?? 0);
  }

  // --- sessions ---------------------------------------------------------

  async createSession(
    accountId: string,
    tokenHash: string,
    expiresAt: string,
  ): Promise<SessionRow> {
    const createdAt = new Date().toISOString();
    await this.db.query(
      `MATCH (a:Account {id: $accountId})
       CREATE (a)-[:HasSession]->(s:Session {
         id: $tokenHash, created_at: $createdAt, expires_at: $expiresAt
       })`,
      { accountId, tokenHash, createdAt, expiresAt },
    );
    return { id: tokenHash, created_at: createdAt, expires_at: expiresAt };
  }

  /** One hop: the session and the account it belongs to, in a single query. */
  async findSession(
    tokenHash: string,
  ): Promise<{ session: SessionRow; account: AccountRow } | null> {
    const rows = await this.db.query<
      RawAccountRow & { s_created_at: string; s_expires_at: string }
    >(
      `MATCH (a:Account)-[:HasSession]->(s:Session {id: $tokenHash})
       ${RETURN_ACCOUNT}, s.created_at AS s_created_at, s.expires_at AS s_expires_at`,
      { tokenHash },
    );
    const row = rows[0];
    if (!row) return null;
    return {
      account: toAccountRow(row),
      session: {
        id: tokenHash,
        created_at: row.s_created_at,
        expires_at: row.s_expires_at,
      },
    };
  }

  async extendSession(tokenHash: string, expiresAt: string): Promise<void> {
    await this.db.query(
      `MATCH (s:Session {id: $tokenHash}) SET s.expires_at = $expiresAt`,
      { tokenHash, expiresAt },
    );
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.query(`MATCH (s:Session {id: $tokenHash}) DETACH DELETE s`, {
      tokenHash,
    });
  }

  /** Used when a credential dies: every session of that account goes with it. */
  async deleteSessionsForAccount(accountId: string): Promise<void> {
    await this.db.query(
      `MATCH (:Account {id: $accountId})-[:HasSession]->(s:Session) DETACH DELETE s`,
      { accountId },
    );
  }

  async deleteExpiredSessions(now: string): Promise<void> {
    await this.db.query(
      `MATCH (s:Session) WHERE s.expires_at < $now DETACH DELETE s`,
      { now },
    );
  }

  // --- credentials ------------------------------------------------------

  async findCredential(accountId: string): Promise<CredentialRow | null> {
    const rows = await this.db.query<
      Omit<CredentialRow, 'version'> & { version: number | bigint }
    >(
      `MATCH (:Account {id: $accountId})-[:HasCredential]->(c:GhCredential)
       RETURN c.id AS id, c.access_token_enc AS access_token_enc,
              c.access_expires_at AS access_expires_at,
              c.refresh_token_enc AS refresh_token_enc,
              c.refresh_expires_at AS refresh_expires_at,
              c.version AS version`,
      { accountId },
    );
    const row = rows[0];
    return row ? { ...row, version: Number(row.version) } : null;
  }

  /** Sign-in replaces the credential wholesale: the previous pair is dead anyway. */
  async replaceCredential(
    accountId: string,
    input: CredentialInput,
  ): Promise<CredentialRow> {
    await this.deleteCredential(accountId);
    const id = newUuid();
    await this.db.query(
      `MATCH (a:Account {id: $accountId})
       CREATE (a)-[:HasCredential]->(c:GhCredential {
         id: $id,
         access_token_enc: $accessTokenEnc, access_expires_at: $accessExpiresAt,
         refresh_token_enc: $refreshTokenEnc, refresh_expires_at: $refreshExpiresAt,
         version: 0, created_at: $createdAt
       })`,
      {
        accountId,
        id,
        accessTokenEnc: input.accessTokenEnc,
        accessExpiresAt: input.accessExpiresAt,
        refreshTokenEnc: input.refreshTokenEnc,
        refreshExpiresAt: input.refreshExpiresAt,
        createdAt: new Date().toISOString(),
      },
    );
    return { id, version: 0, ...toCredentialColumns(input) };
  }

  /**
   * The rotation write, under the optimistic-concurrency `version` column: a
   * refresh invalidates the pair it replaced, so a concurrent refresher that
   * lost the race must not overwrite the winner's tokens with its own dead
   * ones — it reloads instead.
   */
  async rotateCredential(
    id: string,
    input: CredentialInput,
    expectedVersion: number,
  ): Promise<CredentialRow> {
    const rows = await this.db.query<{ version: number | bigint }>(
      `MATCH (c:GhCredential {id: $id})
       WHERE c.version = $expectedVersion
       SET c.access_token_enc = $accessTokenEnc,
           c.access_expires_at = $accessExpiresAt,
           c.refresh_token_enc = $refreshTokenEnc,
           c.refresh_expires_at = $refreshExpiresAt,
           c.version = c.version + 1
       RETURN c.version AS version`,
      {
        id,
        expectedVersion,
        accessTokenEnc: input.accessTokenEnc,
        accessExpiresAt: input.accessExpiresAt,
        refreshTokenEnc: input.refreshTokenEnc,
        refreshExpiresAt: input.refreshExpiresAt,
      },
    );
    const row = rows[0];
    if (!row) throw new ConcurrencyConflictError('GhCredential', id);
    return { id, version: Number(row.version), ...toCredentialColumns(input) };
  }

  async deleteCredential(accountId: string): Promise<void> {
    await this.db.query(
      `MATCH (:Account {id: $accountId})-[:HasCredential]->(c:GhCredential) DETACH DELETE c`,
      { accountId },
    );
  }

  // --- installations ----------------------------------------------------

  async listInstallations(accountId: string): Promise<InstallationRow[]> {
    return this.db.query<InstallationRow>(
      `MATCH (:Account {id: $accountId})-[:HasInstallation]->(i:GhInstallation)
       RETURN i.id AS id, i.account_login AS account_login,
              i.account_type AS account_type,
              i.repository_selection AS repository_selection,
              i.created_at AS created_at
       ORDER BY i.account_login`,
      { accountId },
    );
  }

  /**
   * An installation is GitHub's row, not ours, so this is upsert-shaped: the
   * same org installed by a second member must not duplicate the node, only
   * gain a second `HasInstallation` edge.
   */
  async linkInstallation(
    accountId: string,
    installation: Omit<InstallationRow, 'created_at'>,
  ): Promise<void> {
    const params = {
      accountId,
      id: installation.id,
      accountLogin: installation.account_login,
      accountType: installation.account_type,
      repositorySelection: installation.repository_selection,
      createdAt: new Date().toISOString(),
    };
    await this.db.query(
      `MERGE (i:GhInstallation {id: $id})
       ON CREATE SET i.account_login = $accountLogin, i.account_type = $accountType,
                     i.repository_selection = $repositorySelection, i.created_at = $createdAt
       ON MATCH SET i.account_login = $accountLogin, i.account_type = $accountType,
                    i.repository_selection = $repositorySelection`,
      params,
    );
    await this.db.query(
      `MATCH (a:Account {id: $accountId}), (i:GhInstallation {id: $id})
       MERGE (a)-[:HasInstallation]->(i)`,
      { accountId, id: installation.id },
    );
  }

  /** Installations the account no longer has on GitHub stop being listed here. */
  async replaceInstallations(
    accountId: string,
    installations: readonly Omit<InstallationRow, 'created_at'>[],
  ): Promise<void> {
    await this.db.query(
      `MATCH (:Account {id: $accountId})-[r:HasInstallation]->(:GhInstallation) DELETE r`,
      { accountId },
    );
    for (const installation of installations) {
      await this.linkInstallation(accountId, installation);
    }
  }

  // --- invites ----------------------------------------------------------

  async listInvites(): Promise<InviteRow[]> {
    return this.db.query<InviteRow>(
      `MATCH (i:Invite)
       RETURN i.id AS id, i.gh_login AS gh_login, i.invited_by AS invited_by,
              i.created_at AS created_at, i.accepted_at AS accepted_at
       ORDER BY i.created_at DESC`,
    );
  }

  async findPendingInvite(ghLogin: string): Promise<InviteRow | null> {
    const rows = await this.db.query<InviteRow>(
      `MATCH (i:Invite)
       WHERE i.gh_login = $ghLogin AND i.accepted_at IS NULL
       RETURN i.id AS id, i.gh_login AS gh_login, i.invited_by AS invited_by,
              i.created_at AS created_at, i.accepted_at AS accepted_at
       ORDER BY i.created_at
       LIMIT 1`,
      { ghLogin },
    );
    return rows[0] ?? null;
  }

  async createInvite(ghLogin: string, invitedBy: string): Promise<InviteRow> {
    const row: InviteRow = {
      id: newUuid(),
      gh_login: ghLogin,
      invited_by: invitedBy,
      created_at: new Date().toISOString(),
      accepted_at: null,
    };
    await this.db.query(
      `CREATE (i:Invite {
         id: $id, gh_login: $ghLogin, invited_by: $invitedBy,
         created_at: $createdAt, accepted_at: NULL
       })`,
      {
        id: row.id,
        ghLogin,
        invitedBy,
        createdAt: row.created_at,
      },
    );
    return row;
  }

  /**
   * Consuming an invite is itself conditional on it still being unaccepted, so
   * one invite admits exactly one account however many callbacks race for it.
   */
  async acceptInvite(id: string, acceptedAt: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      `MATCH (i:Invite {id: $id})
       WHERE i.accepted_at IS NULL
       SET i.accepted_at = $acceptedAt
       RETURN i.id AS id`,
      { id, acceptedAt },
    );
    return rows.length > 0;
  }

  async deleteInvite(id: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      `MATCH (i:Invite {id: $id}) RETURN i.id AS id`,
      { id },
    );
    if (rows.length === 0) return false;
    await this.db.query(`MATCH (i:Invite {id: $id}) DETACH DELETE i`, { id });
    return true;
  }
}

function accountParams(profile: GhProfile, role: AccountRole) {
  return {
    id: newUuid(),
    ghUserId: BigInt(profile.ghUserId),
    login: profile.login,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    email: profile.email,
    role,
    createdAt: new Date().toISOString(),
  };
}

function toAccountRow(raw: RawAccountRow): AccountRow {
  return {
    ...raw,
    gh_user_id: Number(raw.gh_user_id),
    version: Number(raw.version),
    role: raw.role === 'owner' ? 'owner' : 'member',
  };
}

function toCredentialColumns(input: CredentialInput) {
  return {
    access_token_enc: input.accessTokenEnc,
    access_expires_at: input.accessExpiresAt,
    refresh_token_enc: input.refreshTokenEnc,
    refresh_expires_at: input.refreshExpiresAt,
  };
}
