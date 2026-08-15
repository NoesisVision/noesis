import type { Context } from 'hono';
import {
  deleteCookie,
  getCookie,
  getSignedCookie,
  setCookie,
  setSignedCookie,
} from 'hono/cookie';
import { SESSION_TTL_MS } from './session.service.js';

export const SESSION_COOKIE = 'noesis_session';
export const STATE_COOKIE = 'noesis_oauth_state';

/** The `state` cookie only has to outlive a trip to github.com and back. */
export const STATE_TTL_SECONDS = 10 * 60;

/**
 * `SameSite=Lax` is both sufficient and necessary here: the OAuth callback is
 * a top-level GET navigation, which `Lax` permits and `Strict` would drop —
 * the browser would arrive at `/auth/callback` with no cookies and the flow
 * could never complete.
 */
function baseCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
  } as const;
}

export function setSessionCookie(
  c: Context,
  token: string,
  secure: boolean,
): void {
  setCookie(c, SESSION_COOKIE, token, {
    ...baseCookieOptions(secure),
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function readSessionCookie(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

export function clearSessionCookie(c: Context, secure: boolean): void {
  deleteCookie(c, SESSION_COOKIE, baseCookieOptions(secure));
}

/**
 * GitHub does not support PKCE, so CSRF protection on the flow is the `state`
 * parameter compared against this cookie. Signing it (rather than storing the
 * state server-side) keeps the flow stateless until a session actually exists.
 */
export async function setStateCookie(
  c: Context,
  state: string,
  secret: string,
  secure: boolean,
): Promise<void> {
  await setSignedCookie(c, STATE_COOKIE, state, secret, {
    ...baseCookieOptions(secure),
    maxAge: STATE_TTL_SECONDS,
  });
}

export async function readStateCookie(
  c: Context,
  secret: string,
): Promise<string | undefined> {
  const value = await getSignedCookie(c, secret, STATE_COOKIE);
  // hono returns `false` when the signature does not verify; that is a failed
  // check, not a missing cookie, and both end the flow the same way.
  return typeof value === 'string' ? value : undefined;
}

export function clearStateCookie(c: Context, secure: boolean): void {
  deleteCookie(c, STATE_COOKIE, baseCookieOptions(secure));
}
