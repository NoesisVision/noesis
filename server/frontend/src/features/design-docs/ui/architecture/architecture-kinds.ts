import type { LaidOutNode } from './layout-architecture.ts';

export interface Kind {
  /** The node type that draws it. */
  type: 'hexagon' | 'domainCore' | 'card';
  /** What a screen reader hears it called. */
  word: string;
  subtitle?: string;
  /** What the legend and the details call it; kinds that share a name share a legend entry. */
  name?: string;
}

/*
 * Every kind of node, by what the layout calls it: the node type that draws
 * it and its name. The cards, the legend and the details all read this one
 * map, so none of them can call a kind what another does not. How a kind
 * looks is the stylesheet's, keyed by the same name.
 */
export const KINDS: Record<LaidOutNode['kind'], Kind> = {
  hexagon: { type: 'hexagon', word: 'module', name: 'Module · hexagon' },
  domainCore: { type: 'domainCore', word: 'domain core' },
  actor: { type: 'card', word: 'actor' },
  caller: {
    type: 'card',
    word: 'unknown caller',
    subtitle: 'caller unknown',
  },
  adapterIn: {
    type: 'card',
    word: 'in adapter, not designed',
    subtitle: 'not designed',
    name: 'In / out adapter',
  },
  adapterOut: {
    type: 'card',
    word: 'out adapter, not designed',
    subtitle: 'not designed',
    name: 'In / out adapter',
  },
  drivingPort: {
    type: 'card',
    word: 'driving port',
    name: 'Driving port',
  },
  service: {
    type: 'card',
    word: 'application service',
    name: 'Application service',
  },
  element: {
    type: 'card',
    word: 'domain core',
    name: 'Domain core',
  },
  drivenPort: {
    type: 'card',
    word: 'driven port',
    name: 'Driven port',
  },
};

/** A frame — a hexagon, or the core inside it — is the backdrop the cards stand on. */
export const isFrame = (kind: LaidOutNode['kind']) =>
  KINDS[kind].type !== 'card';

export interface LegendEntry {
  label: string;
  kinds: LaidOutNode['kind'][];
}

export const LEGEND = legendEntries();

/** The legend's entries, in the order the kinds are listed; kinds that share a name share one. */
function legendEntries(): LegendEntry[] {
  const entries = new Map<string, LaidOutNode['kind'][]>();
  for (const kind of Object.keys(KINDS) as LaidOutNode['kind'][]) {
    const { name } = KINDS[kind];
    // A frame is the backdrop, not a kind of card to pick out.
    if (name === undefined || isFrame(kind)) continue;
    const kinds = entries.get(name);
    if (kinds) kinds.push(kind);
    else entries.set(name, [kind]);
  }
  return [...entries].map(([label, kinds]) => ({ label, kinds }));
}
