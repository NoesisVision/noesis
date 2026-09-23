import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { CREATE_CHANGE, LIST_CHANGES } from '../tool-names';
import { failure } from '../tool-result';

const SLUG_EXAMPLE = '"payment-retry"';

/**
 * The input of a tool that adds one working file to a change. The slug is a
 * plain string on purpose: whether it names a change is domain knowledge,
 * answered in-band by `withChange`, so a shape check adds nothing. The scratch
 * directory is named here rather than in the server's instructions because
 * this description is served by the process that owns it.
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
 * Runs `run` for the change named by `raw`, answering in-band when `raw` is
 * not a slug or names no change. The MCP twin of the ui's `inChange`.
 */
export async function withChange(
  raw: string,
  subject: string,
  run: (slug: ChangeSlug) => Promise<CallToolResult>,
): Promise<CallToolResult> {
  const slug = ChangeSlug.tryCreate(raw);
  if (slug.isErr()) return notASlug(raw);
  try {
    return await run(slug.value);
  } catch (error) {
    if (error instanceof ChangeNotFoundError) {
      return noSuchChange(error, subject);
    }
    throw error;
  }
}

function notASlug(value: string): CallToolResult {
  return failure(
    `${JSON.stringify(value)} is not a change slug.`,
    `A slug is lower-case kebab-case, as ${CREATE_CHANGE} returned it, e.g. ${SLUG_EXAMPLE}.`,
  );
}

function noSuchChange(
  error: ChangeNotFoundError,
  subject: string,
): CallToolResult {
  return failure(
    error.message,
    `Create it with ${CREATE_CHANGE} first, then add the ${subject} to the slug it returns.`,
  );
}
