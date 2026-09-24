import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { ADD_CHANGE, ENTITY_ID_SCRIPT, LIST_CHANGES } from '../tool-names';
import { failure } from '../tool-result';

const ID_EXAMPLE = '"2026-09-24-payment-retry"';

/**
 * The `path` parameter of every tool that reads a working file. The scratch
 * directory is named here rather than in the server's instructions because
 * this description is served by the process that owns it.
 */
export function workingFilePath(
  session: SessionDir,
  subject: string,
  fileShape: string,
) {
  return z
    .string()
    .describe(
      `Path to a JSON working file holding the ${subject}: ${fileShape} Write it yourself into this session's scratch directory, ${session.path}, which is deleted when the session ends; any path under .noesis/tmp/ is accepted. The ${subject} never travels in this call.`,
    );
}

/**
 * What a working file's `id` field asks of the agent: a new id from the
 * plugin's script, or the stored one to update.
 */
export function idInstructions(subject: string, titleField: string): string {
  return `"id" is the ${subject}'s creation date, then its ${titleField} as a slug: for a new ${subject}, get it from the plugin's ${ENTITY_ID_SCRIPT} script (\`bun ${ENTITY_ID_SCRIPT} "<${titleField}>"\`); to update one, reuse its stored id, even when the ${titleField} changed. An id already in use updates that ${subject} in place, so check the existing ones first.`;
}

/**
 * The input of a tool that adds one working file to a change. The change id
 * is a plain string on purpose: whether it names a change is domain
 * knowledge, answered in-band by `withChange`, so a shape check adds nothing.
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
          `The id of the change the ${subject} belongs to, as ${LIST_CHANGES} lists it, e.g. ${ID_EXAMPLE}.`,
        ),
      path: workingFilePath(session, subject, fileShape),
    })
    .describe(`The change to add to, and where its ${subject} is written.`);
}

/** How an add answers whether it created the entity or updated it. */
export function createdOrUpdated(created: boolean): string {
  return created ? 'Created' : 'Updated';
}

/**
 * Runs `run` for the change named by `raw`, answering in-band when `raw` is
 * not a change id or names no change. The MCP twin of the ui's `inChange`.
 */
export async function withChange(
  raw: string,
  subject: string,
  run: (change: ChangeId) => Promise<CallToolResult>,
): Promise<CallToolResult> {
  const change = ChangeId.safeParse(raw);
  if (!change.success) return notAChangeId(raw);
  try {
    return await run(change.data);
  } catch (error) {
    if (error instanceof ChangeNotFoundError) {
      return noSuchChange(error, subject);
    }
    throw error;
  }
}

function notAChangeId(value: string): CallToolResult {
  return failure(
    `${JSON.stringify(value)} is not a change id.`,
    `A change id is a creation date, then a lower-case kebab-case slug, as ${LIST_CHANGES} lists it, e.g. ${ID_EXAMPLE}.`,
  );
}

function noSuchChange(
  error: ChangeNotFoundError,
  subject: string,
): CallToolResult {
  return failure(
    error.message,
    `Add it with ${ADD_CHANGE} first, then add the ${subject} to its id.`,
  );
}
