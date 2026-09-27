import type { BackendClient } from './backend-client';
import { type NoesisApi, noesisApi } from './noesis-api';

/** The `/ui` surface of the repository's backend, connecting — and starting it — on the first call. */
export function backendApi(client: BackendClient): NoesisApi {
  return noesisApi(async () => {
    const connection = await client.connection();
    return {
      origin: connection.origin,
      lost: () => client.forget(connection),
    };
  });
}
