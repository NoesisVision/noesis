import { type Context, Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../../auth/auth.middleware.js';
import type { InboxItemRow } from '../../inbox/inbox.repository.js';
import {
  DeferPastEventStartError,
  InboxItemNotFoundError,
  type InboxService,
  InvalidInboxStateError,
  ProjectNotFoundForInboxError,
} from '../../inbox/inbox.service.js';
import type { ProjectsService } from '../../projects/projects.service.js';

export interface InboxDeps {
  inboxService: InboxService;
  projectsService: ProjectsService;
}

const titleSchema = z.string().trim().min(1).max(200);

export const captureSchema = z.object({
  kind: z.enum(['note', 'transcript']),
  title: titleSchema,
  body: z.string().max(20_000).default(''),
  origin: z.string().trim().max(200).default(''),
});

// Source-agnostic signal contract (inbox.md constraints): what a monitoring
// system, calendar bridge or future MCP source pushes. An event carries its
// start; a repeat carries the sender's dedup key — dedup is never guessed.
export const signalSchema = z
  .object({
    kind: z.enum(['alert', 'event', 'transcript']),
    title: titleSchema,
    origin: z.string().trim().min(1).max(200),
    body: z.string().max(20_000).default(''),
    dedupKey: z.string().trim().min(1).max(200).optional(),
    eventStart: z.iso.datetime().optional(),
  })
  .refine((s) => s.kind !== 'event' || s.eventStart !== undefined, {
    message: 'An event signal needs eventStart.',
  });

export const dismissSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export const deferSchema = z.object({
  until: z.iso.datetime(),
});

/** What an inbox item looks like to the client. */
function toItemDto(row: InboxItemRow) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    origin: row.origin,
    body: row.body,
    dedupKey: row.dedup_key,
    eventStart: row.event_start,
    snoozedUntil: row.snoozed_until,
    state: row.state,
    count: row.count,
    occurrences: row.occurrences,
    outcome:
      row.outcome_at === null
        ? null
        : {
            by: row.outcome_by,
            at: row.outcome_at,
            reason: row.outcome_reason,
          },
    firstSeenAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

/**
 * Mounted at `/ui/projects` behind `requireSession` — the per-project team
 * inbox (inbox.md). Reads sweep lifecycle state first (expiry, wake) so the
 * client always sees items in their true state; refusals mirror the projects
 * routes' vocabulary (404 `not_found`, 409 `invalid_state`).
 */
export function createInboxApp(deps: InboxDeps) {
  const { inboxService, projectsService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return (
    new Hono<AuthEnv>()
      .get('/:projectId/inbox', async (c) => {
        const projectId = c.req.param('projectId');
        if ((await projectsService.findById(projectId)) === null) {
          return c.json({ error: 'not_found' }, 404);
        }
        const items = await inboxService.list(projectId);
        return c.json({ items: items.map(toItemDto) });
      })

      // Manual capture — the "drop it in before it is forgotten" story. A
      // capture with an attached file's content arrives as kind `transcript`.
      .post('/:projectId/inbox', async (c) => {
        const parsed = captureSchema.safeParse(await c.req.json());
        if (!parsed.success) {
          return c.json({ error: z.prettifyError(parsed.error) }, 400);
        }
        const account = c.get('account');
        const by = account.name.trim() !== '' ? account.name : account.login;
        try {
          const item = await inboxService.capture(c.req.param('projectId'), {
            ...parsed.data,
            origin: parsed.data.origin !== '' ? parsed.data.origin : `by ${by}`,
          });
          return c.json({ item: toItemDto(item) }, 201);
        } catch (error) {
          const refused = refusalResponse(c, error);
          if (refused !== null) return refused;
          throw error;
        }
      })

      // Signal intake for external sources. v1 rides the ui session (the
      // webhook/API auth model is an open question in inbox.md); the contract
      // itself is source-agnostic so future senders plug in unchanged.
      .post('/:projectId/inbox/signals', async (c) => {
        const parsed = signalSchema.safeParse(await c.req.json());
        if (!parsed.success) {
          return c.json({ error: z.prettifyError(parsed.error) }, 400);
        }
        try {
          const item = await inboxService.ingest(
            c.req.param('projectId'),
            parsed.data,
          );
          return c.json({ item: toItemDto(item) }, 201);
        } catch (error) {
          const refused = refusalResponse(c, error);
          if (refused !== null) return refused;
          throw error;
        }
      })

      .post('/:projectId/inbox/:itemId/dismiss', async (c) => {
        const parsed = dismissSchema.safeParse(await c.req.json());
        if (!parsed.success) {
          return c.json({ error: z.prettifyError(parsed.error) }, 400);
        }
        return withRefusals(c, async () => {
          const account = c.get('account');
          const item = await inboxService.dismiss(
            c.req.param('projectId'),
            c.req.param('itemId'),
            account.name.trim() !== '' ? account.name : account.login,
            parsed.data.reason,
          );
          return c.json({ item: toItemDto(item) });
        });
      })

      .post('/:projectId/inbox/:itemId/defer', async (c) => {
        const parsed = deferSchema.safeParse(await c.req.json());
        if (!parsed.success) {
          return c.json({ error: z.prettifyError(parsed.error) }, 400);
        }
        return withRefusals(c, async () => {
          const item = await inboxService.defer(
            c.req.param('projectId'),
            c.req.param('itemId'),
            parsed.data.until,
          );
          return c.json({ item: toItemDto(item) });
        });
      })

      .post('/:projectId/inbox/:itemId/wake', async (c) => {
        return withRefusals(c, async () => {
          const item = await inboxService.wake(
            c.req.param('projectId'),
            c.req.param('itemId'),
          );
          return c.json({ item: toItemDto(item) });
        });
      })

      .post('/:projectId/inbox/:itemId/promote', async (c) => {
        return withRefusals(c, async () => {
          const account = c.get('account');
          const item = await inboxService.promote(
            c.req.param('projectId'),
            c.req.param('itemId'),
            account.name.trim() !== '' ? account.name : account.login,
          );
          return c.json({ item: toItemDto(item) });
        });
      })

      .post('/:projectId/inbox/:itemId/restore', async (c) => {
        return withRefusals(c, async () => {
          const item = await inboxService.restore(
            c.req.param('projectId'),
            c.req.param('itemId'),
          );
          return c.json({ item: toItemDto(item) });
        });
      })
  );
}

async function withRefusals(
  c: Context<AuthEnv>,
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    const refused = refusalResponse(c, error);
    if (refused !== null) return refused;
    throw error;
  }
}

/** The refusal vocabulary shared by every inbox write. */
function refusalResponse(c: Context<AuthEnv>, error: unknown): Response | null {
  if (
    error instanceof InboxItemNotFoundError ||
    error instanceof ProjectNotFoundForInboxError
  ) {
    return c.json({ error: 'not_found' }, 404);
  }
  if (error instanceof InvalidInboxStateError) {
    return c.json({ error: 'invalid_state', state: error.state }, 409);
  }
  if (error instanceof DeferPastEventStartError) {
    return c.json(
      { error: 'defer_past_event_start', eventStart: error.eventStart },
      400,
    );
  }
  return null;
}
