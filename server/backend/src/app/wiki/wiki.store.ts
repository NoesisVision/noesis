import { DecisionSchema, TopicSchema } from '@repo/shared-contracts';
import { createNoesisStore } from '../../platform/files/bun-noesis-store.js';
import type { NoesisDir } from '../../platform/files/noesis-dir.js';

/**
 * The wiki: `.noesis/graph/wiki/topics/` and `.noesis/graph/wiki/decisions/`,
 * two root collections keyed by id, change-independent — the distillate
 * accumulates across every import. The topic tree is in the data
 * (`parent_id`), so both collections stay flat; `wiki/` is a grouping
 * directory, not an object (decision D2).
 */
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
