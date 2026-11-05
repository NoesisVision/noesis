import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import type { AgentFiles } from '#backend/app/agent/agent-files';

const UPLOADS_DIR_NAME = 'uploads';

/**
 * Files the person hands the session, kept in this session's scratch
 * directory: any path under `.noesis/sessions/` is one the tools accept, and
 * it goes with the session when it ends. Each file gets a directory of its
 * own, so a second file of the same name never replaces the first, which an
 * earlier message may still name, and the file keeps the name the skills
 * read a title from.
 */
export class SessionAgentFiles implements AgentFiles {
  private readonly dir: string;

  constructor(sessionDir: string) {
    this.dir = join(sessionDir, UPLOADS_DIR_NAME);
  }

  async save(name: string, bytes: Uint8Array): Promise<string> {
    const dir = join(this.dir, uuidv7());
    await mkdir(dir, { recursive: true });
    const path = join(dir, name);
    await writeFile(path, bytes);
    return path;
  }
}
