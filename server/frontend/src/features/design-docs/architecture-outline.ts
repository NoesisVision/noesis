import type { OutlineChange } from '#/shared/ui/model-tree/model-outline.ts';
import type { DesignedNeedInput } from '#backend/app/design-docs/design-doc.ts';

/*
 * The design placed in hexagons, as the architecture view and its checks read
 * it.
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

/** A check's level as a reader reads it, wherever it is named. */
export const LEVEL_LABEL: Record<ArchitectureCheck['level'], string> = {
  warning: 'Warning',
  note: 'Note',
  pass: 'Pass',
};

const DRIVEN_PORTS = ['repository', 'external_integration'] as const;

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

export const isDrivenPort = (pattern: string | null): boolean =>
  (DRIVEN_PORTS as readonly (string | null)[]).includes(pattern);
