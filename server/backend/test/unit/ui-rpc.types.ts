import type { hc } from 'hono/client';
import type { AppType } from '#backend/boot/app.types';

// Compile-only contract checks; this function is never invoked.
export async function checkUiRpcTypes(client: ReturnType<typeof hc<AppType>>) {
  const found = await client.changes[':id'].$get({
    param: { id: 'payment-retry' },
  });
  if (found.status === 200) {
    const name: string = (await found.json()).change.name;
    void name;
  }
  const designDocs = await client.changes[':change']['design-docs'].$get({
    param: { change: 'payment-retry' },
  });
  if (designDocs.status === 200) {
    const body = await designDocs.json();
    void body.designDocs;
    // @ts-expect-error Successful responses retain their inferred fields.
    void body.nonexistent;
  }
  // The page writes what a person may: a change, a revised design document,
  // an added or removed document. Each is typed by its route's schema.
  const created = await client.changes.$post({
    json: { name: 'Retry', type: 'feature' },
  });
  if (created.status === 201) {
    const id: string = (await created.json()).change.id;
    void id;
  }
  await client.changes.$post({
    // @ts-expect-error A new change has no id: the server mints it.
    json: { id: 'x', name: 'Retry', type: 'feature', key: '', description: '' },
  });
  await client.changes[':change'].documents.$post({
    param: { change: 'payment-retry' },
    json: { title: 'Notes', date: '2026-09-24', content: 'x' },
  });
  await client.changes[':change'].documents[':id'].$delete({
    param: { change: 'payment-retry', id: 'doc-1' },
  });
  // @ts-expect-error A design document is created by the agent, not here.
  await client.changes[':change']['design-docs'].$post({
    param: { change: 'payment-retry' },
    json: {},
  });
  // @ts-expect-error No design document is deleted here.
  await client.changes[':change']['design-docs'][':id'].$delete({
    param: { change: 'payment-retry', id: 'doc-1' },
  });
  // @ts-expect-error A document is added or removed, never revised here.
  await client.changes[':change'].documents[':id'].$put({
    param: { change: 'payment-retry', id: 'doc-1' },
    json: {},
  });
}
