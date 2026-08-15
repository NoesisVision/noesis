import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

// GitHub tokens are the one thing in the graph that is worth stealing on its
// own, so they are encrypted at rest under NOESIS_TOKEN_KEY (decision 46).
// AES-256-GCM: a random 12-byte IV per record, and the auth tag stored beside
// the ciphertext so tampering fails loudly instead of decrypting to garbage.
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encrypts to a single self-describing string, `iv.tag.ciphertext` in
 * base64url — one column, no separate IV/tag columns to keep in sync.
 */
export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString('base64url'))
    .join('.');
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

export function decryptSecret(payload: string, key: Buffer): string {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new DecryptionError('Malformed ciphertext.');
  }
  const [iv, tag, ciphertext] = parts.map((part) =>
    Buffer.from(part, 'base64url'),
  ) as [Buffer, Buffer, Buffer];
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new DecryptionError('Malformed ciphertext.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // GCM's own integrity check failed: wrong key, or the record was edited.
    throw new DecryptionError('Ciphertext failed authentication.');
  }
}

/** 32 random bytes, base64url — the session cookie's value. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Only the hash of a session token is ever stored, so a database read cannot
 * impersonate anyone. SHA-256 without a salt is deliberate: the input is 256
 * bits of entropy, so there is nothing to brute-force, and an unsalted digest
 * is what makes the lookup a primary-key hit.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time comparison for the OAuth `state` parameter. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
