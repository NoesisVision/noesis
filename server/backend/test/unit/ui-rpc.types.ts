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
  if (found.status === 200) {
    const { change } = await found.json();
    void change.designDocs;
    void change.sourceDocuments;
    // @ts-expect-error Successful responses retain their inferred fields.
    void change.nonexistent;
  }
  // @ts-expect-error The change lists its design documents.
  await client.changes[':change']['design-docs'].$get({
    param: { change: 'payment-retry' },
  });
  const created = await client.changes.$post({
    json: { name: 'Retry', type: 'feature', key: '', description: '' },
  });
  if (created.status === 201) {
    const id: string = (await created.json()).change.id;
    void id;
  }
  // @ts-expect-error A change is created from its name and type, at least.
  await client.changes.$post({ json: { name: 'Retry' } });
  // What a change owns is written through the same working files the MCP
  // tools read.
  const added = await client.changes[':change']['source-documents'].$post({
    param: { change: 'payment-retry' },
    json: {
      title: 'Interview',
      date: '2026-09-12',
      content: 'What they said.',
    },
  });
  if (added.status === 201) {
    const id: string = (await added.json()).sourceDocument.id;
    void id;
  }
  await client.changes[':change']['design-docs'][':id'].$put({
    param: { change: 'payment-retry', id: 'doc-1' },
    json: { name: 'Retry', description: '' },
  });
  await client.changes[':id'].$patch({
    param: { id: 'payment-retry' },
    json: { name: 'Retry', type: 'fix', status: 'design' },
  });
  await client.changes[':change']['design-docs'].$post({
    param: { change: 'payment-retry' },
    // @ts-expect-error A design document is its working file, not wrapped in one.
    json: { document: {} },
  });
  // @ts-expect-error No design document is deleted here.
  await client.changes[':change']['design-docs'][':id'].$delete({
    param: { change: 'payment-retry', id: 'doc-1' },
  });
  await client.changes[':id'].$patch({
    param: { id: 'payment-retry' },
    // @ts-expect-error An update names the status it leaves the change in.
    json: { name: 'Retry', type: 'fix' },
  });
}
