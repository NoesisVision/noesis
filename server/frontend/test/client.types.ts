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

// The document crosses the wire as the shape an outline is projected from,
// not as `unknown`, and the outline itself is no part of the answer.
export async function checkDesignDocClient(client: typeof api) {
  const data = await client.changes[':change']['design-docs'][':id'].$get({
    param: { change: 'test-2', id: 'doc-refunds' },
  });
  const id: string | undefined = data.document.buildingBlocks?.added?.[0]?.id;
  const name: string = data.document.name;
  void [id, name];
  // @ts-expect-error The tree is the reader's; the wire carries none.
  void data.outline;
}
