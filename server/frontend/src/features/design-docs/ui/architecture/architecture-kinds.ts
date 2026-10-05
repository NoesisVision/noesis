import {
  ARCHITECTURE_KIND_META,
  type ArchitectureKind,
  type ArchitectureKindMeta,
} from '../../architecture-outline.ts';

export interface Kind extends ArchitectureKindMeta {
  /** The node type that draws it. */
  type: 'hexagon' | 'domainCore' | 'card';
}

/*
 * Every kind of node, by what the layout calls it: the node type that draws
 * it and what the model calls it. The cards, the legend and the details all
 * read this one map. How a kind looks is the stylesheet's, keyed by the same
 * name.
 */
export const KINDS: Record<ArchitectureKind, Kind> = {
  hexagon: { ...ARCHITECTURE_KIND_META.hexagon, type: 'hexagon' },
  domainCore: { ...ARCHITECTURE_KIND_META.domainCore, type: 'domainCore' },
  actor: card('actor'),
  caller: card('caller'),
  adapterIn: card('adapterIn'),
  adapterOut: card('adapterOut'),
  drivingPort: card('drivingPort'),
  service: card('service'),
  element: card('element'),
  drivenPort: card('drivenPort'),
};

/** A frame — a hexagon, or the core inside it — is the backdrop the cards stand on. */
export const isFrame = (kind: ArchitectureKind) => KINDS[kind].type !== 'card';

/** Whether a node fades while the reader picks out these kinds; a frame is the backdrop and never does. */
export const fades = (
  kind: ArchitectureKind,
  picked: readonly ArchitectureKind[] | undefined,
) => picked !== undefined && !isFrame(kind) && !picked.includes(kind);

export interface LegendEntry {
  label: string;
  kinds: ArchitectureKind[];
}

export const LEGEND = legendEntries();

/** The legend's entries, in the order the kinds are listed; kinds that share a name share one. */
function legendEntries(): LegendEntry[] {
  const entries = new Map<string, ArchitectureKind[]>();
  for (const kind of Object.keys(KINDS) as ArchitectureKind[]) {
    const { name } = KINDS[kind];
    // A frame is the backdrop, not a kind of card to pick out.
    if (name === undefined || isFrame(kind)) continue;
    const kinds = entries.get(name);
    if (kinds) kinds.push(kind);
    else entries.set(name, [kind]);
  }
  return [...entries].map(([label, kinds]) => ({ label, kinds }));
}

function card(kind: ArchitectureKind): Kind {
  return { ...ARCHITECTURE_KIND_META[kind], type: 'card' };
}
