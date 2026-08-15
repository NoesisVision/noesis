import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../../auth/auth.middleware.js';
import { requireOwner } from '../../auth/auth.middleware.js';
import type { AuthModule } from '../../auth/auth.module.js';

export interface InvitesDeps {
  authModule: AuthModule;
}

// GitHub's own rule for a login: alphanumerics and single inner hyphens, up to
// 39 characters. Validating it here turns a typo into a 400 instead of an
// invite that can never be accepted.
const ghLoginSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/,
    'Not a valid GitHub login.',
  );

export const inviteRequestSchema = z.object({ ghLogin: ghLoginSchema });

/**
 * Mounted at `/ui/invites` behind `requireSession`, and behind `requireOwner`
 * on top of it: invites are the one place `role` is load-bearing. The response
 * types reach the ui through `AppType`, so there is no contracts package.
 */
export function createInvitesApp(deps: InvitesDeps) {
  const module = deps.authModule;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono<AuthEnv>()
    .use('*', requireOwner())
    .get('/', async (c) => {
      if (module.mode === 'disabled') return c.json({ invites: [] });
      return c.json({ invites: await module.auth.listInvites() });
    })
    .post('/', async (c) => {
      // `NOESIS_AUTH_MODE=disabled` has no accounts to invite anyone into, so
      // the write endpoints say so rather than pretending to succeed.
      if (module.mode === 'disabled') {
        return c.json({ error: 'auth_disabled' }, 503);
      }
      const parsed = inviteRequestSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json({ error: z.prettifyError(parsed.error) }, 400);
      }
      const invite = await module.auth.invite(
        parsed.data.ghLogin,
        c.get('account'),
      );
      return c.json({ invite }, 201);
    })
    .delete('/:id', async (c) => {
      if (module.mode === 'disabled') {
        return c.json({ error: 'auth_disabled' }, 503);
      }
      const revoked = await module.auth.revokeInvite(c.req.param('id'));
      if (!revoked) return c.json({ error: 'not_found' }, 404);
      return c.body(null, 204);
    });
}
