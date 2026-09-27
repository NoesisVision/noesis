import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/model/change-id';
import { LIST_CHANGES } from '#mcp/server/tool-names';
import type { SessionFiles } from '#mcp/session/session-files';

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
        `The id of the change the ${subject} belongs to, as ${LIST_CHANGES} lists it, e.g. "2026-09-24-payment-retry".`,
      ),
      path: workingFilePath(files, subject, fileShape),
    })
    .describe(`The change the ${subject} is in, and where it is written.`);
}

/** What a working file says of its id, which only the server mints. */
export const NO_ID =
  'Leave "id" out: the server mints it when it creates the entity and answers with it.';
