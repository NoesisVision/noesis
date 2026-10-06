// Lists the fields of a design document's working file that a person wrote
// or accepted in the Noesis page, each by the path the service's issue list
// names it by, with its value. An agent asks before changing any of them and
// keeps every other one exactly as it is.
//
//   bun human-fields.ts <working-file.json>
import { readFile } from 'node:fs/promises';

export interface HumanField {
  path: string;
  value: unknown;
}

export function humanFields(designDoc: unknown): HumanField[] {
  return [...walk(designDoc, '')];
}

function* walk(node: unknown, path: string): Generator<HumanField> {
  if (Array.isArray(node)) {
    for (const [index, item] of node.entries()) {
      yield* walk(item, `${path}[${keyOf(item, index)}]`);
    }
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  if (isHumanField(node)) {
    yield { path, value: node.value };
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    yield* walk(child, path === '' ? key : `${path}.${key}`);
  }
}

function isHumanField(node: object): node is { value: unknown } {
  return (
    'changed' in node &&
    node.changed === true &&
    'value' in node &&
    'author' in node &&
    node.author === 'human'
  );
}

/** Names an item the way the service's issue list does: by id, else name, else type. */
function keyOf(item: unknown, index: number): string {
  if (typeof item === 'string') return item;
  if (typeof item !== 'object' || item === null) return String(index);
  for (const key of ['id', 'name', 'type']) {
    const candidate = (item as Record<string, unknown>)[key];
    if (typeof candidate === 'string') return candidate;
  }
  return String(index);
}

async function main(): Promise<void> {
  const [workingPath, ...rest] = process.argv.slice(2);
  if (!workingPath || rest.length > 0) {
    throw new Error('Usage: human-fields.ts <working-file.json>');
  }
  const fields = humanFields(JSON.parse(await readFile(workingPath, 'utf8')));
  console.log(JSON.stringify(fields, null, 2));
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
