import {
  type SystemModel,
  SystemModelSchema,
} from '#backend/app/system-model/system-model';
import { JsonCollection } from '#backend/platform/files/json-collection';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

// Scanner-owned: a hand edit is overwritten by the next scan, so no locks.
export function createSystemModelStore(noesis: NoesisDir): SystemModelStore {
  return new JsonCollection(
    SystemModelSchema,
    noesis.resolve('graph', 'system-models'),
    'system-model',
  );
}
export type SystemModelStore = JsonCollection<SystemModel>;
