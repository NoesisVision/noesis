import { DecisionSchema } from '#backend/app/wiki/model/decision';
import { TopicSchema } from '#backend/app/wiki/model/topic';
import { createNoesisStore } from '#backend/platform/files/bun-noesis-store';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

// The topic tree lives in `parent_id`, so both collections stay flat
// (decision D2).
export function createTopicsStore(noesis: NoesisDir) {
  return createNoesisStore({
    directory: noesis.resolve('graph', 'wiki', 'topics'),
    schema: TopicSchema,
  });
}
export type TopicsStore = ReturnType<typeof createTopicsStore>;

export function createDecisionsStore(noesis: NoesisDir) {
  return createNoesisStore({
    directory: noesis.resolve('graph', 'wiki', 'decisions'),
    schema: DecisionSchema,
  });
}
export type DecisionsStore = ReturnType<typeof createDecisionsStore>;
