import type { hc } from 'hono/client';
import type { AppType } from '../../src/app.types.js';

// Compile-only contract checks; this function is never invoked.
export async function checkUiRpcTypes(client: ReturnType<typeof hc<AppType>>) {
  const created = await client.changes.$post({
    json: { name: 'Payment retry', type: 'feature' },
  });
  if (created.status === 201) {
    const name: string = (await created.json()).change.name;
    void name;
  }
  await client.changes[':id'].$get({ param: { id: 'payment-retry' } });
  const document = await client.changes[':change']['design-docs'].$post({
    param: { change: 'payment-retry' },
    json: { document: {} },
  });
  if (document.status === 201) {
    const body = await document.json();
    void body.designDoc;
    // @ts-expect-error Successful responses retain their inferred fields.
    void body.nonexistent;
  }
  // @ts-expect-error The change name is required.
  await client.changes.$post({ json: { type: 'feature' } });
  // @ts-expect-error Change types are a fixed union.
  await client.changes.$post({ json: { name: 'Retry', type: 'invalid' } });
  // @ts-expect-error This endpoint accepts JSON, not form data.
  await client.changes.$post({ form: { name: 'Retry', type: 'feature' } });
}
