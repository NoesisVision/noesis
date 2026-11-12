import type { OutlineChange } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { DRIVEN_PORTS } from '#/shared/model/building-block-kinds.ts';
import type { DesignedNeedInput } from '#backend/app/design-docs/design-doc.ts';
import type {
  BehaviorId,
  BuildingBlockId,
  ElementId,
  ModuleId,
} from '#backend/app/element-id.ts';
import type {
  BuildingBlockKind,
  RuleKind,
} from '#backend/app/system-model/system-model.ts';

/*
 * The design placed in hexagons, as the architecture view and its checks read
 * it.
 */

export interface ArchitectureOutline {
  hexagons: Hexagon[];
  /** Elements the view cannot place: a type the design neither sets nor knows. */
  unplaced: PlacedElement[];
  checks: ArchitectureCheck[];
  needsAtPorts: { need: DesignedNeedInput; ports: BehaviorId[] }[];
}

export interface Hexagon {
  module: { id: ModuleId; name: string };
  drivingPorts: DrivingPort[];
  applicationServices: PlacedBlock[];
  domainCore: PlacedBlock[];
  drivenPorts: PlacedBlock[];
  /** Behaviors of any block but an application service that a manual process or another module calls: the core reached past its ports. */
  exposed: PlacedBehavior[];
}

interface DrivingPort {
  behavior: PlacedBehavior;
  /** The application service the behavior is on. */
  service: BuildingBlockId;
  /** Who performs the manual processes that invoke it, by name. */
  actors: string[];
  /** Whether a manual process invokes it; when none does, another subsystem calls it. */
  callerKnown: boolean;
}

export interface PlacedElement<
  Id extends BuildingBlockId | BehaviorId = BuildingBlockId | BehaviorId,
> {
  id: Id;
  name: string;
  /** The building block type; null for a behavior, which has none. */
  pattern: BuildingBlockKind | null;
  change: OutlineChange;
  /** The building blocks its properties, inputs and outputs are typed by, whatever their cardinality; itself left out. */
  uses: BuildingBlockId[];
  /** The rules it governs, and for a block those its behaviors govern, which the view does not draw apart from it. */
  rules: PlacedRule[];
}

export type PlacedBlock = PlacedElement<BuildingBlockId>;
export type PlacedBehavior = PlacedElement<BehaviorId>;

export interface PlacedRule {
  id: string;
  name: string;
  kind: RuleKind | null;
  needs: string[];
}

export interface ArchitectureCheck {
  id: string;
  level: 'warning' | 'note' | 'pass';
  title: string;
  text: string;
  /** What it concerns when it fails; what it checked when it passes. */
  elementIds: ElementId[];
}

/**
 * A check's level as a reader reads it, wherever it is named: a word as well
 * as a colour, and what the elements it names are to it.
 */
export const CHECK_LEVEL_META: Record<
  ArchitectureCheck['level'],
  { label: string; color: string; elements: string }
> = {
  warning: { label: 'Warning', color: 'orange', elements: 'Concerns' },
  note: { label: 'Note', color: 'gray', elements: 'Concerns' },
  pass: { label: 'Pass', color: 'green', elements: 'Checked' },
};

/** Every element in a hexagon, in the order the rings are drawn. */
export const elementsOf = (hexagon: Hexagon): PlacedElement[] => [
  ...hexagon.drivingPorts.map(({ behavior }) => behavior),
  ...hexagon.applicationServices,
  ...hexagon.domainCore,
  ...hexagon.drivenPorts,
];

/**
 * Every element the outline holds, by id: the ones the hexagons draw, the
 * behaviors that expose a core — on their block's card, not one of their
 * own — and the ones no ring could take.
 */
export const placedById = (
  outline: Pick<ArchitectureOutline, 'hexagons' | 'unplaced'>,
): Map<string, PlacedElement> =>
  new Map(
    [
      ...outline.hexagons.flatMap((hexagon) => [
        ...elementsOf(hexagon),
        ...hexagon.exposed,
      ]),
      ...outline.unplaced,
    ].map((element) => [element.id, element]),
  );

export const isDrivenPort = (pattern: BuildingBlockKind | null): boolean =>
  (DRIVEN_PORTS as readonly (BuildingBlockKind | null)[]).includes(pattern);

/*
 * What the hexagons draw, by kind: the frames (a module's hexagon, the domain
 * core inside it), the cards of the elements in each ring, and those the
 * design does not hold but a hexagon has — who drives it and its adapters.
 * The diagram, its legend and the details all read these names, so none of
 * them can call a kind what another does not.
 */
export type ArchitectureKind =
  | 'hexagon'
  | 'domainCore'
  | 'actor'
  | 'caller'
  | 'adapterIn'
  | 'adapterOut'
  | 'drivingPort'
  | 'service'
  | 'element'
  | 'drivenPort';

export interface ArchitectureKindMeta {
  /** What a screen reader hears it called. */
  word: string;
  /** What it says under its name, when not the element's type. */
  subtitle?: string;
  /** What the legend and the details call it; kinds that share a name share a legend entry. */
  name?: string;
  /** Its own name, when it draws no element of the design and has none of its own. */
  label?: string;
  /** What the details say of it, when the design does not hold it. */
  about?: {
    eyebrow: string;
    title?: (portName: string) => string;
    text: (portName: string) => string;
    /** What its port is to it. */
    port?: string;
  };
}

export const DOMAIN_CORE_NAME = 'Domain core';

export const ARCHITECTURE_KIND_META: Record<
  ArchitectureKind,
  ArchitectureKindMeta
> = {
  hexagon: { word: 'module', name: 'Module · hexagon' },
  domainCore: { word: 'domain core', label: DOMAIN_CORE_NAME },
  actor: {
    word: 'actor',
    about: {
      eyebrow: 'Actor',
      text: () =>
        'Performs a manual process that invokes this port, through an in adapter.',
    },
  },
  caller: {
    word: 'unknown caller',
    subtitle: 'caller unknown',
    label: 'Another subsystem',
    about: {
      eyebrow: 'Caller · unknown',
      text: (port) =>
        `${port} is invoked by no manual process, so another subsystem calls it. Which one is not in the design document.`,
      port: 'Calls',
    },
  },
  adapterIn: {
    word: 'in adapter, not designed',
    subtitle: 'not designed',
    name: 'In / out adapter',
    label: 'in adapter',
    about: {
      eyebrow: 'In adapter · not designed',
      title: (port) => `In adapter for ${port}`,
      text: (port) =>
        `Turns a request into a call of the driving port ${port}: a REST endpoint, a UI, a message listener. The design document holds no adapters.`,
      port: 'Adapts',
    },
  },
  adapterOut: {
    word: 'out adapter, not designed',
    subtitle: 'not designed',
    name: 'In / out adapter',
    label: 'out adapter',
    about: {
      eyebrow: 'Out adapter · not designed',
      title: (port) => `Out adapter for ${port}`,
      text: (port) =>
        `Implements the driven port ${port} with a technology: a database, a message broker, an HTTP client. The design document holds no adapters.`,
      port: 'Implements',
    },
  },
  drivingPort: { word: 'driving port', name: 'Driving port' },
  service: { word: 'application service', name: 'Application service' },
  element: { word: 'domain core', name: DOMAIN_CORE_NAME },
  drivenPort: { word: 'driven port', name: 'Driven port' },
};
