import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { ChangeId } from '#backend/app/changes/model/change-id';
import { NotFoundError } from '#backend/app/not-found-error';
import { CREATE_CHANGE, LIST_CHANGES } from '../tool-names';
import { failure } from '../tool-result';

const ID_EXAMPLE = '"2026-09-24-payment-retry"';

/**
 * The `path` parameter of every tool that reads a working file. The scratch
 * directory is named here rather than in the server's instructions because
 * this description is served by the process that owns it.
 */
export function workingFilePath(
  files: SessionFiles,
  subject: string,
  fileShape: string,
) {
  return z
    .string()
    .describe(
      `Path to a JSON working file holding the ${subject}: ${fileShape} Write it yourself into this session's scratch directory, ${files.dir}, which is deleted when the session ends; any path under .noesis/sessions/ is accepted. The ${subject} never travels in this call.`,
    );
}

/** The input of a tool that writes one working file into a change. */
export function inChangeInput(
  files: SessionFiles,
  subject: string,
  fileShape: string,
) {
  return z
    .object({
      change: ChangeId.describe(
        `The id of the change the ${subject} belongs to, as ${LIST_CHANGES} lists it, e.g. ${ID_EXAMPLE}.`,
      ),
      path: workingFilePath(files, subject, fileShape),
    })
    .describe(`The change the ${subject} is in, and where it is written.`);
}

/** What a working file says of its id, which only the server mints. */
export const NO_ID =
  'Leave "id" out: the server mints it when it creates the entity and answers with it.';

/**
 * Runs `run`, answering in-band when the change it looks up does not exist.
 * The SDK has already answered an id that is not a change id at all.
 */
export async function withChange(
  run: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NotFoundError && error.entity === 'change') {
      return failure(
        error.message,
        `Find the change's id with ${LIST_CHANGES}, or create it with ${CREATE_CHANGE}.`,
      );
    }
    throw error;
  }
}

/** The answer to a working file that could not be read or does not fit its schema. */
export function unreadableFile(subject: string, error: string): CallToolResult {
  return failure(`Could not read the ${subject}:\n${error}`);
}
