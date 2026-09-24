import type { api } from '../src/shared/api/client';

// Compile-only checks for request and unwrapped success types.
export async function checkJsonClient(client: typeof api) {
  const data = await client.changes[':id'].$get({ param: { id: 'retry' } });
  const name: string = data.change.name;
  void name;
  // @ts-expect-error HTTP errors are thrown, not returned as success data.
  void data.error;
  // @ts-expect-error The result is already parsed JSON.
  data.json();
  // @ts-expect-error Request validation types remain intact.
  await client.changes[':id'].$get({ param: {} });
}

// The outline crosses the wire as a usable array, not as `unknown`: a flat
// shape is what survives hono's JSON inference, where a recursive one does not.
export async function checkOutlineClient(client: typeof api) {
  const data = await client.changes[':change']['design-docs'][':id'].$get({
    param: { change: 'test-2', id: 'doc-refunds' },
  });
  const first = data.outline[0];
  const name: string | undefined = first?.name;
  const depth: number | undefined = first?.depth;
  const parent: string | null | undefined = first?.parentPath;
  void [name, depth, parent];
  // @ts-expect-error The outline names the kinds it knows.
  const kind: 'nonsense' = data.outline[0]!.kind;
  void kind;
}
