import type { hc } from 'hono/client';
import type { AppType } from '#backend/app.types';

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
  // The ui surface only reads; the agent writes through the MCP tools.
  // @ts-expect-error No change is created here.
  await client.changes.$post({ json: { name: 'Retry', type: 'feature' } });
  // @ts-expect-error No design document is created here.
  await client.changes[':change']['design-docs'].$post({
    param: { change: 'payment-retry' },
    json: { document: {} },
  });
  // @ts-expect-error No design document is deleted here.
  await client.changes[':change']['design-docs'][':id'].$delete({
    param: { change: 'payment-retry', id: 'doc-1' },
  });
  // @ts-expect-error No document is added here.
  await client.changes[':change'].documents.$post({
    param: { change: 'payment-retry' },
    json: { document: {} },
  });
}
