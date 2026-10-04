import type { Hexagon, PlacedElement } from './architecture-outline.ts';

/*
 * The building block types a reader may leave out of the hexagons. Driving
 * ports are behaviours, not building blocks, so they are always drawn, as are
 * the actors and callers before them; an element whose type the design leaves
 * unset has nothing to be left out by.
 */

export interface TypeRing {
  ring: 'Application' | 'Domain core' | 'Driven ports';
  types: { pattern: string; count: number }[];
}

const RINGS = [
  ['Application', (hexagon) => hexagon.applicationServices],
  ['Domain core', (hexagon) => hexagon.domainCore],
  ['Driven ports', (hexagon) => hexagon.drivenPorts],
] as const satisfies readonly [
  TypeRing['ring'],
  (hexagon: Hexagon) => PlacedElement[],
][];

/** Every type the hexagons draw, by the ring it sits in, in the order the cards are drawn. */
export function buildingBlockTypesOf(hexagons: Hexagon[]): TypeRing[] {
  return RINGS.map(([ring, elementsIn]) => {
    const counts = new Map<string, number>();
    for (const { pattern } of hexagons.flatMap(elementsIn))
      if (pattern !== null) counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
    return {
      ring,
      types: [...counts].map(([pattern, count]) => ({ pattern, count })),
    };
  }).filter(({ types }) => types.length > 0);
}

/** The hexagons without the building blocks of the hidden types, to be laid out afresh. */
export function withoutTypes(
  hexagons: Hexagon[],
  hidden: ReadonlySet<string>,
): Hexagon[] {
  if (hidden.size === 0) return hexagons;
  const shown = (element: PlacedElement) =>
    element.pattern === null || !hidden.has(element.pattern);
  return hexagons.map((hexagon) => ({
    ...hexagon,
    applicationServices: hexagon.applicationServices.filter(shown),
    domainCore: hexagon.domainCore.filter(shown),
    drivenPorts: hexagon.drivenPorts.filter(shown),
  }));
}
