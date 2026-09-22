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
