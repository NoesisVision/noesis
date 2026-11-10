import { z } from 'zod';
import { type BuildingBlockRef, type SystemModel } from './system-model';

/**
 * The scanned model read as a graph, and nothing more: its elements by id,
 * kind, name and type, what contains each, which block uses which, which
 * behavior calls which. It is what a diagram of the model is drawn from, and
 * small enough to answer an agent inline where the whole model is not.
 */

const GraphElement = z.object({
  id: z.string(),
  kind: z.enum(['module', 'building_block', 'behavior']),
  name: z.string(),
  /** The building block's or behavior's type; null for a module. */
  type: z.string().nullable(),
  /** The element that contains this one; null at the top. */
  container: z.string().nullable(),
});
type GraphElement = z.infer<typeof GraphElement>;

const Pair = z.tuple([z.string(), z.string()]);

export const SystemModelGraph = z.object({
  modelId: z.string(),
  scannedAt: z.string(),
  elements: z.array(GraphElement),
  /** Which block or behavior uses which block, as `[source, target]`, each pair once. */
  uses: z.array(Pair),
  /** Which behavior calls which, as `[caller, called]`, each pair once. */
  invokes: z.array(Pair),
});
export type SystemModelGraph = z.infer<typeof SystemModelGraph>;

/** The building blocks a type names, through any collection of them. */
function blocksOf(ref: BuildingBlockRef): string[] {
  if (typeof ref === 'object') return blocksOf(ref.collectionOf);
  return ref.startsWith('building_block|') ? [ref] : [];
}

export function graphOf(model: SystemModel): SystemModelGraph {
  const blockIds = new Set<string>(model.buildingBlocks.map(({ id }) => id));
  const containerOf = new Map<string, string>();
  for (const element of [...model.modules, ...model.buildingBlocks])
    for (const relation of element.relations)
      if (relation.kind !== 'building_block_extends_building_block')
        containerOf.set(relation.to, relation.from);
  const container = (id: string) => containerOf.get(id) ?? null;

  const elements: GraphElement[] = [
    ...model.modules.map((module) => ({
      id: module.id,
      kind: 'module' as const,
      name: module.name,
      type: null,
      container: container(module.id),
    })),
    ...model.buildingBlocks.map((block) => ({
      id: block.id,
      kind: 'building_block' as const,
      name: block.name,
      type: block.type,
      container: container(block.id),
    })),
    ...model.behaviors.map((behavior) => ({
      id: behavior.id,
      kind: 'behavior' as const,
      name: behavior.name,
      type: behavior.type,
      container: container(behavior.id),
    })),
  ];

  const uses = new Map<string, [string, string]>();
  const use = (source: string, refs: BuildingBlockRef[]) => {
    for (const target of refs.flatMap(blocksOf))
      if (target !== source && blockIds.has(target))
        uses.set(`${source}->${target}`, [source, target]);
  };
  for (const block of model.buildingBlocks)
    use(
      block.id,
      block.properties.map(({ type }) => type),
    );
  for (const behavior of model.behaviors)
    use(behavior.id, [
      ...behavior.input.map(({ type }) => type),
      ...behavior.output.map(({ type }) => type),
    ]);

  const behaviorIds = new Set(model.behaviors.map(({ id }) => id));
  const invokes = new Map<string, [string, string]>();
  for (const behavior of model.behaviors)
    for (const { to: called } of behavior.relations)
      if (called !== behavior.id && behaviorIds.has(called))
        invokes.set(`${behavior.id}->${called}`, [behavior.id, called]);

  return {
    modelId: model.id,
    scannedAt: model.scanned_at,
    elements,
    uses: [...uses.values()],
    invokes: [...invokes.values()],
  };
}
