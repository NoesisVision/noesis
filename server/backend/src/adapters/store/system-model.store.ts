import { SystemModel } from '#backend/app/system-model/system-model';
import { createNoesisStore } from '#backend/platform/files/bun-noesis-store';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

// Scanner-owned: a hand edit is overwritten by the next scan, so no locks.
export function createSystemModelStore(noesis: NoesisDir) {
  return createNoesisStore({
    directory: noesis.resolve('graph', 'system-model'),
    schema: SystemModel,
  });
}
export type SystemModelStore = ReturnType<typeof createSystemModelStore>;
