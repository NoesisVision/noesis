import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
} from 'bun:test';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { createNoesisStore } from '../../src/files/bun-noesis-store.js';
import {
  type NoesisStore,
  NoesisStoreError,
} from '../../src/files/noesis-store.js';

const ChangeSchema = z.strictObject({
  slug: z.string(),
  name: z.string(),
  status: z.enum(['discovery', 'active', 'done']).default('discovery'),
});

const DesignDocSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  content: z.string(),
});

const AttachmentSchema = z.strictObject({
  id: z.string(),
  bytes: z.number(),
});

const ConversationSchema = z.strictObject({
  conversation_id: z.string(),
  title: z.string().optional(),
});

let root: string;
let graph: string;

function changesStore() {
  return createNoesisStore({
    directory: join(graph, 'changes'),
    schema: ChangeSchema,
    children: {
      conversations: ConversationSchema,
      'design-docs': {
        schema: DesignDocSchema,
        children: { attachments: AttachmentSchema },
      },
    },
  });
}

let changes: ReturnType<typeof changesStore>;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'noesis-store-'));
  graph = join(root, '.noesis', 'graph');
  changes = changesStore();
});

afterEach(() => rm(root, { recursive: true, force: true }));

const change = (slug: string, name = slug) => ({ slug, name });
const doc = (id: string) => ({ id, name: `Doc ${id}`, content: '# Hi' });

async function collect(keys: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const key of keys) out.push(key);
  return out.sort();
}

async function failure(promise: Promise<unknown>): Promise<NoesisStoreError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(NoesisStoreError);
    return error as NoesisStoreError;
  }
  throw new Error('expected the operation to fail');
}

describe('createNoesisStore', () => {
  it('infers input, output and child handles from the definition', async () => {
    await changes.set('improve-auth', change('improve-auth', 'Improve auth'));
    const stored = await changes.get('improve-auth');
    // `status` is defaulted on output: present here, optional on input.
    expect(stored?.status).toBe('discovery');

    const { 'design-docs': designDocs, conversations } =
      changes.children('improve-auth');
    await designDocs.set('d1', doc('d1'));
    await designDocs
      .children('d1')
      .attachments.set('a1', { id: 'a1', bytes: 3 });
    await conversations.set('c1', { conversation_id: 'c1' });

    expect((await designDocs.get('d1'))?.content).toBe('# Hi');
    expect((await conversations.get('c1'))?.conversation_id).toBe('c1');

    // Compile-time only: what the handle types refuse.
    const refused = () => {
      // @ts-expect-error — undeclared child collections are not on the handle.
      changes.children('improve-auth').documents;
      // @ts-expect-error — a leaf has no children.
      conversations.children('c1').anything;
      // @ts-expect-error — input is typed by the schema.
      return changes.set('x', { slug: 'x' });
    };
    expect(refused).toBeFunction();
  });

  it('types the handle by the definition (compile-time)', () => {
    type Change = z.output<typeof ChangeSchema>;
    type ChangeInput = z.input<typeof ChangeSchema>;
    type DesignDoc = z.output<typeof DesignDocSchema>;
    type Attachment = z.output<typeof AttachmentSchema>;
    type Conversation = z.output<typeof ConversationSchema>;

    // Root: output on get, input on set — `status` optional in, present out.
    expectTypeOf(changes.get).returns.resolves.toEqualTypeOf<Change | null>();
    expectTypeOf<
      Parameters<typeof changes.set>[1]
    >().toEqualTypeOf<ChangeInput>();
    expectTypeOf<ChangeInput['status']>().toEqualTypeOf<
      'discovery' | 'active' | 'done' | undefined
    >();
    expectTypeOf<Change['status']>().toEqualTypeOf<
      'discovery' | 'active' | 'done'
    >();

    // Children: exactly the declared names, each with its own schema.
    const children = changes.children('c');
    expectTypeOf(children).toHaveProperty('conversations');
    expectTypeOf(children).toHaveProperty('design-docs');
    expectTypeOf(children).not.toHaveProperty('documents');
    expectTypeOf<keyof typeof children>().toEqualTypeOf<
      'conversations' | 'design-docs'
    >();
    expectTypeOf(
      children.conversations.get,
    ).returns.resolves.toEqualTypeOf<Conversation | null>();
    expectTypeOf(
      children['design-docs'].get,
    ).returns.resolves.toEqualTypeOf<DesignDoc | null>();

    // A nested definition yields grandchildren; a leaf yields none.
    const grandchildren = children['design-docs'].children('d');
    expectTypeOf<keyof typeof grandchildren>().toEqualTypeOf<'attachments'>();
    expectTypeOf(
      grandchildren.attachments.get,
    ).returns.resolves.toEqualTypeOf<Attachment | null>();
    expectTypeOf(children.conversations.children('c')).toEqualTypeOf<
      Record<never, never>
    >();
    expectTypeOf(grandchildren.attachments.children('a')).toEqualTypeOf<
      Record<never, never>
    >();

    // The handle is the contract's interface, nothing implementation-specific.
    expectTypeOf(changes).toMatchTypeOf<
      NoesisStore<ChangeInput, Change, typeof children>
    >();
  });

  it('touches no file when constructing a handle or asking for children', async () => {
    changes.children('never-written');
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it('rejects an invalid definition synchronously', () => {
    expect(() =>
      createNoesisStore({
        directory: graph,
        schema: ChangeSchema,
        children: { 'bad name': DesignDocSchema },
      }),
    ).toThrow(/child collection name "bad name"/);
    expect(() =>
      createNoesisStore({
        directory: graph,
        schema: ChangeSchema,
        children: { docs: DesignDocSchema, Docs: AttachmentSchema },
      }),
    ).toThrow(/differ only by case/);
    expect(() =>
      createNoesisStore({ directory: '', schema: ChangeSchema }),
    ).toThrow(/directory/);
    expect(() =>
      createNoesisStore({
        directory: graph,
        schema: ChangeSchema,
        // @ts-expect-error — not a schema.
        children: { docs: { nope: true } },
      }),
    ).toThrow(/no Zod schema/);
  });
});

describe('layout', () => {
  it('writes <key>/data.json, pretty-printed with a trailing newline, and survives a fresh handle', async () => {
    await changes.set('improve-auth', change('improve-auth', 'Improve auth'));
    await changes.children('improve-auth')['design-docs'].set('d1', doc('d1'));

    const dataFile = join(graph, 'changes', 'improve-auth', 'data.json');
    expect(await readFile(dataFile, 'utf8')).toBe(
      `${JSON.stringify({ slug: 'improve-auth', name: 'Improve auth', status: 'discovery' }, null, 2)}\n`,
    );
    expect(
      await readdir(
        join(graph, 'changes', 'improve-auth', 'design-docs', 'd1'),
      ),
    ).toEqual(['data.json']);

    // A new handle over the same directory is what a restart sees.
    const again = changesStore();
    expect(await again.get('improve-auth')).toEqual({
      slug: 'improve-auth',
      name: 'Improve auth',
      status: 'discovery',
    });
    expect(
      await collect(again.children('improve-auth')['design-docs'].keys()),
    ).toEqual(['d1']);
  });

  it('answers empty, null and false for a collection directory that does not exist', async () => {
    expect(await collect(changes.keys())).toEqual([]);
    expect(await changes.get('nothing')).toBe(null);
    expect(await changes.delete('nothing')).toBe(false);
    await expect(readdir(root)).resolves.toEqual([]);
  });
});

describe('get', () => {
  it('reads only the object file: a corrupt child does not break the parent', async () => {
    await changes.set('c', change('c'));
    const docs = changes.children('c')['design-docs'];
    await docs.set('d1', doc('d1'));
    await writeFile(join(docs.directory, 'd1', 'data.json'), '{ not json');

    expect((await changes.get('c'))?.slug).toBe('c');
    expect((await failure(docs.get('d1'))).code).toBe('INVALID_JSON');
  });

  it('tells invalid JSON from a schema mismatch, keeping the cause', async () => {
    await mkdir(join(graph, 'changes', 'broken'), { recursive: true });
    await writeFile(join(graph, 'changes', 'broken', 'data.json'), '{');
    await mkdir(join(graph, 'changes', 'wrong'), { recursive: true });
    await writeFile(
      join(graph, 'changes', 'wrong', 'data.json'),
      '{"slug":"wrong"}',
    );

    const invalid = await failure(changes.get('broken'));
    expect(invalid.code).toBe('INVALID_JSON');
    expect(invalid.operation).toBe('get');
    expect(invalid.key).toBe('broken');
    expect(invalid.path).toBe(join(graph, 'changes', 'broken', 'data.json'));

    const mismatch = await failure(changes.get('wrong'));
    expect(mismatch.code).toBe('VALIDATION_FAILED');
    expect(mismatch.cause).toBeInstanceOf(z.ZodError);
    expect(mismatch.message).not.toContain('"slug":"wrong"');
  });

  it('returns null for a directory without data.json', async () => {
    await mkdir(join(graph, 'changes', 'residue', 'design-docs'), {
      recursive: true,
    });
    expect(await changes.get('residue')).toBe(null);
  });
});

describe('set', () => {
  it('validates before writing, so invalid input never replaces a valid object', async () => {
    await changes.set('c', change('c', 'Original'));

    const error = await failure(
      changes.set('c', { slug: 'c', name: 'New', extra: 1 } as never),
    );
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.operation).toBe('set');
    expect((await changes.get('c'))?.name).toBe('Original');
    expect(await readdir(join(graph, 'changes', 'c'))).toEqual(['data.json']);
  });

  it('serializes the parsed value, not the input', async () => {
    await changes.set('c', { slug: 'c', name: 'C' });
    expect(
      JSON.parse(
        await readFile(join(graph, 'changes', 'c', 'data.json'), 'utf8'),
      ),
    ).toEqual({
      slug: 'c',
      name: 'C',
      status: 'discovery',
    });
  });

  it('replaces the data file and keeps the descendants', async () => {
    await changes.set('c', change('c', 'One'));
    const docs = changes.children('c')['design-docs'];
    await docs.set('d1', doc('d1'));
    await docs.children('d1').attachments.set('a1', { id: 'a1', bytes: 1 });

    await changes.set('c', change('c', 'Two'));

    expect((await changes.get('c'))?.name).toBe('Two');
    expect(await collect(docs.keys())).toEqual(['d1']);
    expect(await docs.children('d1').attachments.get('a1')).toEqual({
      id: 'a1',
      bytes: 1,
    });
  });

  it('refuses a child write when the parent is missing and creates nothing', async () => {
    const docs = changes.children('ghost')['design-docs'];

    const error = await failure(docs.set('d1', doc('d1')));
    expect(error.code).toBe('PARENT_NOT_FOUND');
    expect(error.key).toBe('d1');
    expect(error.path).toBe(join(graph, 'changes', 'ghost', 'data.json'));
    await expect(readdir(root)).resolves.toEqual([]);

    // The same for a grandchild whose parent exists but grandparent is gone.
    await changes.set('c', change('c'));
    await mkdir(join(graph, 'changes', 'orphan', 'design-docs', 'd1'), {
      recursive: true,
    });
    await writeFile(
      join(graph, 'changes', 'orphan', 'design-docs', 'd1', 'data.json'),
      JSON.stringify(doc('d1')),
    );
    const attachments = changes
      .children('orphan')
      ['design-docs'].children('d1').attachments;
    expect(
      (await failure(attachments.set('a', { id: 'a', bytes: 0 }))).code,
    ).toBe('PARENT_NOT_FOUND');
    expect((await failure(attachments.get('a'))).code).toBe('PARENT_NOT_FOUND');
    expect((await failure(collect(attachments.keys()))).code).toBe(
      'PARENT_NOT_FOUND',
    );
  });

  it('refuses values JSON would silently change', async () => {
    const loose = createNoesisStore({
      directory: join(graph, 'loose'),
      schema: z.object({ id: z.string() }).loose(),
    });
    const cases: Record<string, unknown> = {
      date: new Date(),
      bigint: 1n,
      map: new Map(),
      fn: () => 1,
      nan: Number.NaN,
      hole: (() => {
        const sparse: number[] = [1];
        sparse[2] = 2;
        return sparse;
      })(),
      undefinedElement: [undefined],
    };
    for (const [name, value] of Object.entries(cases)) {
      const error = await failure(loose.set('x', { id: 'x', [name]: value }));
      expect(error.code).toBe('UNSUPPORTED_VALUE');
      expect(error.message).toContain(`$.${name}`);
    }
    const cyclic: { id: string; self?: unknown } = { id: 'x' };
    cyclic.self = cyclic;
    expect((await failure(loose.set('x', cyclic))).code).toBe(
      'UNSUPPORTED_VALUE',
    );
    expect(await loose.get('x')).toBe(null);

    // An undefined property is an omitted optional property, not a loss.
    await loose.set('x', { id: 'x', gone: undefined });
    expect(await readFile(join(graph, 'loose', 'x', 'data.json'), 'utf8')).toBe(
      '{\n  "id": "x"\n}\n',
    );
  });

  it('leaves no temporary file behind after a write', async () => {
    await changes.set('c', change('c'));
    await changes.set('c', change('c', 'again'));
    expect(await readdir(join(graph, 'changes', 'c'))).toEqual(['data.json']);
  });
});

describe('keys', () => {
  it('lists object directories only, without parsing, and skips residue and temp files', async () => {
    await changes.set('a', change('a'));
    await changes.set('b', change('b'));
    await writeFile(
      join(graph, 'changes', 'b', 'data.json'),
      'not json at all',
    );
    await mkdir(join(graph, 'changes', 'no-data', 'design-docs'), {
      recursive: true,
    });
    await writeFile(join(graph, 'changes', 'data.json.abc.tmp'), '{}');
    await mkdir(join(graph, 'changes', 'Not-A-Key'));
    await writeFile(join(graph, 'changes', 'Not-A-Key', 'data.json'), '{}');
    await writeFile(join(graph, 'changes', 'stray.json'), '{}');

    expect(await collect(changes.keys())).toEqual(['a', 'b']);
  });

  it('is scoped to the parent object', async () => {
    await changes.set('a', change('a'));
    await changes.set('b', change('b'));
    await changes.children('a')['design-docs'].set('d1', doc('d1'));
    await changes.children('b')['design-docs'].set('d2', doc('d2'));

    expect(await collect(changes.children('a')['design-docs'].keys())).toEqual([
      'd1',
    ]);
    expect(await collect(changes.children('b')['design-docs'].keys())).toEqual([
      'd2',
    ]);
  });
});

describe('delete', () => {
  it('removes an object that owns nothing and reports a second attempt as false', async () => {
    await changes.set('c', change('c'));
    expect(await changes.delete('c')).toBe(true);
    expect(await changes.get('c')).toBe(null);
    expect(await changes.delete('c')).toBe(false);
  });

  it('refuses a nonempty object without recursive, even for an undeclared collection', async () => {
    await changes.set('c', change('c'));
    await changes.children('c')['design-docs'].set('d1', doc('d1'));

    const error = await failure(changes.delete('c'));
    expect(error.code).toBe('NOT_EMPTY');
    expect(error.key).toBe('c');
    expect(await changes.get('c')).not.toBe(null);

    await changes.children('c')['design-docs'].delete('d1');
    const undeclared = join(graph, 'changes', 'c', 'legacy', 'x');
    await mkdir(undeclared, { recursive: true });
    expect((await failure(changes.delete('c'))).code).toBe('NOT_EMPTY');

    await rm(join(graph, 'changes', 'c', 'legacy'), { recursive: true });
    await writeFile(join(graph, 'changes', 'c', 'notes.md'), '# foreign');
    expect((await failure(changes.delete('c'))).code).toBe('NOT_EMPTY');
  });

  it('ignores empty collection directories and temp files when judging emptiness', async () => {
    await changes.set('c', change('c'));
    const docs = changes.children('c')['design-docs'];
    await docs.set('d1', doc('d1'));
    await docs.delete('d1');
    await writeFile(join(graph, 'changes', 'c', 'data.json.123.tmp'), '{');

    expect(await changes.delete('c')).toBe(true);
    expect(await readdir(join(graph, 'changes'))).toEqual([]);
  });

  it('removes the whole subtree with recursive', async () => {
    await changes.set('c', change('c'));
    const docs = changes.children('c')['design-docs'];
    await docs.set('d1', doc('d1'));
    await docs.children('d1').attachments.set('a1', { id: 'a1', bytes: 1 });
    await changes.set('keep', change('keep'));

    expect(await changes.delete('c', { recursive: true })).toBe(true);
    expect(await readdir(join(graph, 'changes'))).toEqual(['keep']);
  });

  it('retries an interrupted recursive deletion: residue without data.json is removed', async () => {
    await changes.set('c', change('c'));
    await changes.children('c')['design-docs'].set('d1', doc('d1'));
    await rm(join(graph, 'changes', 'c', 'data.json'));

    expect(await changes.get('c')).toBe(null);
    expect(await collect(changes.keys())).toEqual([]);
    expect(await changes.delete('c', { recursive: true })).toBe(true);
    expect(await readdir(join(graph, 'changes'))).toEqual([]);
  });

  it('answers false for a missing child when the parent exists, and PARENT_NOT_FOUND otherwise', async () => {
    await changes.set('c', change('c'));
    expect(await changes.children('c')['design-docs'].delete('d1')).toBe(false);
    const error = await failure(
      changes.children('ghost')['design-docs'].delete('d1'),
    );
    expect(error.code).toBe('PARENT_NOT_FOUND');
  });
});

describe('keys and paths', () => {
  it.each([
    '../escape',
    'a/b',
    '',
    'Upper',
    '.hidden',
    'data.json',
    '-lead',
    `${'k'.repeat(129)}`,
  ])('rejects key %j before touching the disk', async (key) => {
    for (const attempt of [
      () => changes.get(key),
      () => changes.set(key, change('x')),
      () => changes.delete(key),
      async () => changes.children(key),
    ]) {
      const error = await failure(attempt());
      expect(error.code).toBe('INVALID_KEY');
    }
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it('does not follow a symbolic link in place of an object directory or data file', async () => {
    const outside = join(root, 'outside');
    await mkdir(outside);
    await writeFile(
      join(outside, 'data.json'),
      JSON.stringify(change('linked')),
    );
    await mkdir(join(graph, 'changes'), { recursive: true });
    await symlink(outside, join(graph, 'changes', 'linked'));

    expect(await collect(changes.keys())).toEqual([]);
    expect((await failure(changes.get('linked'))).code).toBe('IO_ERROR');
    expect((await failure(changes.set('linked', change('linked')))).code).toBe(
      'IO_ERROR',
    );
    expect((await failure(changes.delete('linked'))).code).toBe('IO_ERROR');
    expect(await readFile(join(outside, 'data.json'), 'utf8')).toBe(
      JSON.stringify(change('linked')),
    );

    await mkdir(join(graph, 'changes', 'file-link'));
    await symlink(
      join(outside, 'data.json'),
      join(graph, 'changes', 'file-link', 'data.json'),
    );
    expect(await collect(changes.keys())).toEqual([]);
    expect((await failure(changes.get('file-link'))).code).toBe('IO_ERROR');
  });
});

describe('concurrency', () => {
  const ConcurrentSchema = z.strictObject({
    writer: z.string(),
    round: z.number(),
    padding: z.string(),
  });

  it('resolves concurrent same-key writes in one process to one complete file', async () => {
    const store = createNoesisStore({
      directory: join(graph, 'race'),
      schema: ConcurrentSchema,
    });
    await Promise.all(
      Array.from({ length: 25 }, (_, round) =>
        store.set('k', { writer: 'w', round, padding: 'x'.repeat(20_000) }),
      ),
    );

    const stored = await store.get('k');
    expect(stored?.padding).toHaveLength(20_000);
    expect(await readdir(join(graph, 'race', 'k'))).toEqual(['data.json']);
  });

  it('resolves concurrent same-key writes from two processes to one complete file', async () => {
    const directory = join(graph, 'race');
    const writer = join(import.meta.dir, 'noesis-store.writer.ts');
    const spawn = (label: string) =>
      Bun.spawn(['bun', writer, directory, 'k', label, '40'], {
        stdout: 'ignore',
        stderr: 'pipe',
      });
    const processes = [spawn('a'), spawn('b')];
    const exits = await Promise.all(processes.map((p) => p.exited));
    const stderr = await Promise.all(
      processes.map((p) => new Response(p.stderr).text()),
    );
    expect({ exits, stderr }).toEqual({ exits: [0, 0], stderr: ['', ''] });

    const store = createNoesisStore({ directory, schema: ConcurrentSchema });
    const stored = await store.get('k');
    expect(stored).not.toBe(null);
    expect(['a', 'b']).toContain(stored?.writer ?? '');
    expect(stored?.round).toBe(39);
    expect(await readdir(join(directory, 'k'))).toEqual(['data.json']);
  });
});
