import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ChangeNotFound } from '#backend/app/changes/change-errors';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { CREATE_CHANGE, LIST_CHANGES } from '../tool-names';
import { failure } from '../tool-result';

const SLUG_EXAMPLE = '"payment-retry"';

/**
 * The input of a tool that adds one working file to a change. The slug is a
 * plain string on purpose: whether it names a change is domain knowledge,
 * answered in-band, so a shape check adds nothing. The scratch directory is
 * named here rather than in the server's instructions because this
 * description is served by the process that owns it.
 */
export function addToChangeInput(
  session: SessionDir,
  subject: string,
  fileShape: string,
) {
  return z
    .object({
      change: z
        .string()
        .describe(
          `The slug of the change the ${subject} belongs to, as ${CREATE_CHANGE} returned it or ${LIST_CHANGES} lists it, e.g. ${SLUG_EXAMPLE}.`,
        ),
      path: z
        .string()
        .describe(
          `Path to a JSON working file holding the ${subject}: ${fileShape} Write it yourself into this session's scratch directory, ${session.path}, which is deleted when the session ends; any path under .noesis/tmp/ is accepted. The ${subject} never travels in this call.`,
        ),
    })
    .describe(`The change to add to, and where its ${subject} is written.`);
}

/**
 * Runs `run` for the slug `raw` spells, answering in-band when it spells
 * none. The MCP twin of the ui's `inChange`.
 */
export function withSlug(
  raw: string,
  run: (slug: ChangeSlug) => Promise<CallToolResult>,
): Promise<CallToolResult> {
  return ChangeSlug.tryCreate(raw).match(run, async () => notASlug(raw));
}

export function noSuchChange(
  error: ChangeNotFound,
  subject: string,
): CallToolResult {
  return failure(
    error.message,
    `Create it with ${CREATE_CHANGE} first, then add the ${subject} to the slug it returns.`,
  );
}

function notASlug(value: string): CallToolResult {
  return failure(
    `${JSON.stringify(value)} is not a change slug.`,
    `A slug is lower-case kebab-case, as ${CREATE_CHANGE} returned it, e.g. ${SLUG_EXAMPLE}.`,
  );
}
