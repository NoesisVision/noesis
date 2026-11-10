import { z } from 'zod';
import type { Handler } from '#backend/app/handler';
import type { AgentFiles } from './agent-files';
import type { AgentAttachment } from './agent-session';

/** A bare file name: never a path, so a write cannot leave the uploads directory. */
const UploadFileName = z
  .string()
  .regex(/^[A-Za-z0-9][\w.-]*$/)
  .max(200);

/**
 * A file from the person's machine, as the page reads it: text as it is,
 * anything else as base64.
 */
export const UploadAgentFile = z.object({
  name: UploadFileName,
  encoding: z.enum(['utf8', 'base64']),
  content: z.string(),
});
export type UploadAgentFile = z.infer<typeof UploadAgentFile>;

export type UploadAgentFileHandler = Handler<UploadAgentFile, AgentAttachment>;

export function uploadAgentFileHandler(
  files: AgentFiles,
): UploadAgentFileHandler {
  return {
    async handle({ name, encoding, content }) {
      const bytes =
        encoding === 'utf8'
          ? new TextEncoder().encode(content)
          : bytesOfBase64(content);
      const path = await files.save(name, bytes);
      return { name, path };
    },
  };
}

/** `atob`, since a Buffer is Node's and this handler is read by the page's types. */
function bytesOfBase64(content: string): Uint8Array {
  return Uint8Array.from(atob(content), (char) => char.codePointAt(0) ?? 0);
}
