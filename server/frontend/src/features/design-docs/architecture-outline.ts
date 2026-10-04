import type { OutlineChange } from '#/shared/ui/model-tree/model-outline.ts';
import type { DesignedNeedInput } from '#backend/app/design-docs/design-doc.ts';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';

/*
 * The design placed in hexagons, as the architecture view and its checks read
 * it, and the few facts about an element that its id alone gives away.
 */

export interface ArchitectureOutline {
  hexagons: Hexagon[];
  /** Elements the view cannot place: a type the design neither sets nor knows. */
  unplaced: PlacedElement[];
  checks: ArchitectureCheck[];
  needsAtPorts: { need: DesignedNeedInput; ports: string[] }[];
}

export interface Hexagon {
  module: { id: string; name: string };
  drivingPorts: DrivingPort[];
  applicationServices: PlacedElement[];
  domainCore: PlacedElement[];
  drivenPorts: PlacedElement[];
  /** Public behaviours of any block but an application service: the core reached past its ports. */
  exposed: PlacedElement[];
}

interface DrivingPort {
  behaviour: PlacedElement;
  /** The application service the behaviour is on. */
  service: string;
  /** Empty when another subsystem calls it. */
  actors: string[];
}

export interface PlacedElement {
  id: string;
  name: string;
  /** The building block type, or the behaviour type. */
  pattern: string | null;
  change: OutlineChange;
  /** The building blocks its properties, inputs and outputs use, collections unwrapped; itself left out. */
  uses: string[];
  /** Its own rules and those of its behaviours the view does not draw apart from it. */
  rules: PlacedRule[];
}

export interface PlacedRule {
  name: string;
  category: string | null;
  ruleType: string | null;
  needs: string[];
}

export interface ArchitectureCheck {
  id: string;
  level: 'warning' | 'note' | 'pass';
  title: string;
  text: string;
  /** What it concerns when it fails; what it checked when it passes. */
  elementIds: string[];
}

const DRIVEN_PORTS = ['repository', 'external_integration'] as const;
const BUILDING_BLOCK = 'building_block|';
const MODULE = 'module|';

/** Every element in a hexagon, in the order the rings are drawn. */
export const elementsOf = (hexagon: Hexagon): PlacedElement[] => [
  ...hexagon.drivingPorts.map(({ behaviour }) => behaviour),
  ...hexagon.applicationServices,
  ...hexagon.domainCore,
  ...hexagon.drivenPorts,
];

export const isDrivenPort = (pattern: string | null): boolean =>
  (DRIVEN_PORTS as readonly (string | null)[]).includes(pattern);

/** The building block a type reference names, through any collection; null for a primitive. */
export function blockOfRef(ref: BuildingBlockRefInput): string | null {
  if (typeof ref !== 'string') return blockOfRef(ref.collectionOf);
  return ref.startsWith(BUILDING_BLOCK) ? ref : null;
}

const addressOf = (id: string) => id.slice(id.indexOf('|') + 1);
const parentAddressOf = (id: string) => {
  const address = addressOf(id);
  return address.slice(0, Math.max(0, address.lastIndexOf('.')));
};

/** The element's own name: `QDoc`, never `qdocmanagement.preparation.QDoc`. */
export const nameOf = (id: string) => addressOf(id).split('.').at(-1) ?? id;

/** The building block a behaviour is on. */
export const ownerOf = (behaviourId: string) =>
  `${BUILDING_BLOCK}${parentAddressOf(behaviourId)}`;

/** The module a building block sits in, or a behaviour's building block does. */
export const moduleOf = (elementId: string) =>
  `${MODULE}${parentAddressOf(
    elementId.startsWith(BUILDING_BLOCK) ? elementId : ownerOf(elementId),
  )}`;
