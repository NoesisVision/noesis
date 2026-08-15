import { describe, expect, it } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { parseServerConfig } from '../../src/config/config.js';
import { testPrivateKey } from './github-fake.js';

const GITHUB_ENV = {
  NOESIS_AUTH_MODE: 'github',
  NOESIS_PUBLIC_URL: 'https://noesis.example',
  NOESIS_GITHUB_APP_ID: '12345',
  NOESIS_GITHUB_APP_SLUG: 'noesis',
  NOESIS_GITHUB_CLIENT_ID: 'Iv1.clientid',
  NOESIS_GITHUB_CLIENT_SECRET: 'secret',
  NOESIS_GITHUB_PRIVATE_KEY: Buffer.from(testPrivateKey()).toString('base64'),
  NOESIS_TOKEN_KEY: randomBytes(32).toString('base64'),
} satisfies NodeJS.ProcessEnv;

describe('server configuration', () => {
  it('accepts a complete GitHub block and decodes its secrets', () => {
    const result = parseServerConfig({ ...GITHUB_ENV });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.auth.mode).toBe('github');
    if (result.config.auth.mode !== 'github') return;
    expect(result.config.auth.privateKey).toContain('-----BEGIN');
    expect(result.config.auth.tokenKey).toHaveLength(32);
  });

  it('strips a trailing slash from the public url', () => {
    const result = parseServerConfig({
      ...GITHUB_ENV,
      NOESIS_PUBLIC_URL: 'https://noesis.example/',
    });

    expect(
      result.ok && result.config.auth.mode === 'github'
        ? result.config.auth.publicUrl
        : null,
    ).toBe('https://noesis.example');
  });

  it('names every missing variable at once rather than one at a time', () => {
    const result = parseServerConfig({ NOESIS_AUTH_MODE: 'github' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('NOESIS_PUBLIC_URL');
    expect(result.message).toContain('NOESIS_TOKEN_KEY');
  });

  it('rejects a token key that is not 32 bytes', () => {
    const result = parseServerConfig({
      ...GITHUB_ENV,
      NOESIS_TOKEN_KEY: randomBytes(16).toString('base64'),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('32 bytes');
  });

  it('rejects a private key that is not a PEM', () => {
    const result = parseServerConfig({
      ...GITHUB_ENV,
      NOESIS_GITHUB_PRIVATE_KEY: Buffer.from('nonsense').toString('base64'),
    });

    expect(result.ok).toBe(false);
  });

  it('accepts a PEM pasted verbatim, newlines and all', () => {
    const result = parseServerConfig({
      ...GITHUB_ENV,
      NOESIS_GITHUB_PRIVATE_KEY: testPrivateKey(),
    });

    expect(result.ok).toBe(true);
  });

  it('allows auth to be disabled outside production, with no GitHub block', () => {
    const result = parseServerConfig({ NOESIS_AUTH_MODE: 'disabled' });

    expect(result.ok).toBe(true);
    expect(result.ok && result.config.auth.mode).toBe('disabled');
  });

  it('refuses to start with auth disabled in production', () => {
    const result = parseServerConfig({
      NOESIS_AUTH_MODE: 'disabled',
      NODE_ENV: 'production',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('NODE_ENV=production');
  });

  it('defaults to github mode, so a bare environment fails loudly', () => {
    expect(parseServerConfig({}).ok).toBe(false);
  });
});
