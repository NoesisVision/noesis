import { describe, expect, it } from 'bun:test';
import { randomBytes } from 'node:crypto';
import {
  DecryptionError,
  decryptSecret,
  encryptSecret,
  hashToken,
  randomToken,
  safeEqual,
} from '../../src/auth/crypto.js';

const KEY = randomBytes(32);

describe('token encryption at rest', () => {
  it('round-trips a token', () => {
    const token = 'ghu_0123456789abcdef';
    expect(decryptSecret(encryptSecret(token, KEY), KEY)).toBe(token);
  });

  it('produces a different ciphertext every time (random IV)', () => {
    const first = encryptSecret('same', KEY);
    const second = encryptSecret('same', KEY);
    expect(first).not.toBe(second);
    expect(decryptSecret(second, KEY)).toBe('same');
  });

  it('rejects a tampered ciphertext instead of returning garbage', () => {
    const payload = encryptSecret('ghu_secret', KEY);
    const [iv, tag, ciphertext] = payload.split('.') as [
      string,
      string,
      string,
    ];
    const flipped = Buffer.from(ciphertext, 'base64url');
    flipped[0] = (flipped[0] as number) ^ 0xff;
    const tampered = [iv, tag, flipped.toString('base64url')].join('.');

    expect(() => decryptSecret(tampered, KEY)).toThrow(DecryptionError);
  });

  it('rejects a ciphertext encrypted under another key', () => {
    const payload = encryptSecret('ghu_secret', KEY);
    expect(() => decryptSecret(payload, randomBytes(32))).toThrow(
      DecryptionError,
    );
  });

  it('rejects a malformed payload', () => {
    expect(() => decryptSecret('not-a-ciphertext', KEY)).toThrow(
      DecryptionError,
    );
  });
});

describe('session token hashing', () => {
  it('is deterministic and does not contain the token', () => {
    const token = randomToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).toHaveLength(64);
  });

  it('mints a distinct token every call', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomToken()));
    expect(tokens.size).toBe(50);
  });
});

describe('safeEqual', () => {
  it('compares equal and unequal values, including different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});
