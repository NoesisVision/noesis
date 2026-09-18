import { SystemModelSchema } from '@repo/shared-contracts';
import { createNoesisStore } from '../infra/files/bun-noesis-store.js';
import type { NoesisDir } from '../infra/files/noesis-dir.js';

/**
 * `.noesis/graph/system-model/`: the implemented model as the scanner
 * projects it, one object per scanned unit keyed by its id. Written by the
 * scanner only; a hand edit is overwritten by the next scan, so nothing here
 * carries locks.
 */
export function createSystemModelStore(noesis: NoesisDir) {
  return createNoesisStore({
    directory: noesis.resolve('graph', 'system-model'),
    schema: SystemModelSchema,
  });
}
export type SystemModelStore = ReturnType<typeof createSystemModelStore>;
