// Builds the add_document_to_change working file from a Markdown file. The
// text is copied by this script, never retyped by the model, so `content` is
// the source byte for byte. A new document gets its id minted from the title
// and today's date; pass `--id` to update an existing one at its stored id.
//
//   bun write-working-file.ts <source.md> <working-file.json> [--id <id>] [--title <title>] [--date <YYYY-MM-DD>]
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname } from 'node:path';
import { parseArgs } from 'node:util';
import { entityId, isoDate } from '../../../scripts/entity-id';

/** The service refuses a larger working file. */
export const MAX_WORKING_FILE_BYTES = 4 * 1024 * 1024;

export interface WorkingFile {
  id: string;
  title: string;
  date: string;
  content: string;
}

export interface WorkingFileOptions {
  /** The stored id of the document to update; left out, a new one is minted. */
  id?: string;
  title?: string;
  date?: string;
}

/** The first level-one heading, or the file name when the text has none. */
export function titleOf(content: string, sourcePath: string): string {
  const heading = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(content);
  return heading?.[1]?.trim() || basename(sourcePath, extname(sourcePath));
}

export async function buildWorkingFile(
  sourcePath: string,
  options: WorkingFileOptions = {},
  today = new Date(),
): Promise<WorkingFile> {
  const content = await readFile(sourcePath, 'utf8');
  const title = options.title?.trim() || titleOf(content, sourcePath);
  return {
    id: options.id ?? entityId(title, today),
    title,
    // A local calendar date, since that is the day the author revised the file on.
    date: options.date ?? isoDate((await stat(sourcePath)).mtime),
    content,
  };
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      id: { type: 'string' },
      title: { type: 'string' },
      date: { type: 'string' },
    },
    allowPositionals: true,
  });
  const [sourcePath, workingPath] = positionals;
  if (!sourcePath || !workingPath || positionals.length > 2) {
    throw new Error(
      'Usage: write-working-file.ts <source.md> <working-file.json> [--id <id>] [--title <title>] [--date <YYYY-MM-DD>]',
    );
  }

  const workingFile = await buildWorkingFile(sourcePath, values);
  const json = `${JSON.stringify(workingFile, null, 2)}\n`;
  const bytes = Buffer.byteLength(json);
  if (bytes > MAX_WORKING_FILE_BYTES) {
    throw new Error(
      `The working file would be ${bytes} bytes; the service accepts at most ${MAX_WORKING_FILE_BYTES}. Split the source into documents of their own.`,
    );
  }

  await mkdir(dirname(workingPath), { recursive: true });
  await writeFile(workingPath, json);
  console.log(
    JSON.stringify({
      path: workingPath,
      id: workingFile.id,
      title: workingFile.title,
      date: workingFile.date,
      contentCharacters: workingFile.content.length,
    }),
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
