import type { OutlineChange } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type { DesignedNeedInput } from '#backend/app/design-docs/design-doc.ts';
import type {
  BehaviorId,
  BuildingBlockId,
  ElementId,
  ModuleId,
} from '#backend/app/element-id.ts';
import type {
  BehaviourType,
  BuildingBlockType,
  RuleCategory,
  RuleType,
} from '#backend/app/system-model/system-model.ts';
import type { kindOf } from './element-id.ts';

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
  /** Public behaviours of any block but an application service: the core reached past its ports. */
  exposed: PlacedBehaviour[];
}

interface DrivingPort {
  behaviour: PlacedBehaviour;
  /** The application service the behaviour is on. */
  service: BuildingBlockId;
  /** Empty when another subsystem calls it. */
  actors: string[];
}

export interface PlacedElement<
  Pattern extends BuildingBlockType | BehaviourType =
    | BuildingBlockType
    | BehaviourType,
> {
  id: Pattern extends BuildingBlockType ? BuildingBlockId : BehaviorId;
  name: string;
  /** The building block type, or the behaviour type. */
  pattern: Pattern | null;
  change: OutlineChange;
  /** The building blocks its properties, inputs and outputs use, collections unwrapped; itself left out. */
  uses: BuildingBlockId[];
  /** Its own rules and those of its behaviours the view does not draw apart from it. */
  rules: PlacedRule[];
}

export type PlacedBlock = PlacedElement<BuildingBlockType>;
export type PlacedBehaviour = PlacedElement<BehaviourType>;

export interface PlacedRule {
  name: string;
  category: RuleCategory | null;
  ruleType: RuleType | null;
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

const DRIVEN_PORTS = [
  'repository',
  'external_integration',
] as const satisfies readonly BuildingBlockType[];

/** Every element in a hexagon, in the order the rings are drawn. */
export const elementsOf = (hexagon: Hexagon): PlacedElement[] => [
  ...hexagon.drivingPorts.map(({ behaviour }) => behaviour),
  ...hexagon.applicationServices,
  ...hexagon.domainCore,
  ...hexagon.drivenPorts,
];

/**
 * Every element the outline holds, by id: the ones the hexagons draw, the
 * behaviours that expose a core — on their block's card, not one of their
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

export const isDrivenPort = (pattern: BuildingBlockType | null): boolean =>
  (DRIVEN_PORTS as readonly (BuildingBlockType | null)[]).includes(pattern);

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
        'Named on a public behaviour as the actor that calls it, through an in adapter.',
    },
  },
  caller: {
    word: 'unknown caller',
    subtitle: 'caller unknown',
    label: 'Another subsystem',
    about: {
      eyebrow: 'Caller · unknown',
      text: (port) =>
        `${port} is public and names no actor, so another subsystem calls it. Which one is not in the design document.`,
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

/** What an element no card draws is called: by what it is, as no ring says more. */
export const UNDRAWN_NAME: Record<ReturnType<typeof kindOf>, string> = {
  module: 'Module',
  building_block: 'Building block',
  behaviour: 'Behaviour',
};
