import type { Hexagon, PlacedElement } from '../../architecture-outline.ts';

/*
 * Every hexagon is drawn in the same bands, top to bottom: who drives it, the
 * in adapters they come through, then inside the hexagon the driving ports,
 * the application services, the domain core in a hexagon of its own and the
 * driven ports, and under it the out adapters. The bands are the same for
 * every hexagon, so the layout is placed by hand rather than by a layout
 * engine: the same design is always drawn the same way.
 *
 * Positions are absolute, in the canvas's own pixels.
 */

type LaidOutKind =
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

export interface LaidOutNode {
  /** The element's id for a card that draws one; a made-up id for the rest. */
  id: string;
  kind: LaidOutKind;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  /** The element a card draws; null for an actor, an adapter or a frame. */
  element: PlacedElement | null;
  /** The element a card stands for when it is chosen: a frame its module, a placeholder its port. */
  selects: string;
}

export interface LaidOutEdge {
  id: string;
  source: string;
  target: string;
  /** `owns` joins a port to its service; the rest are drawn as arrows. */
  kind: 'drives' | 'adapts' | 'owns' | 'implements';
}

export interface ArchitectureLayout {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
}

const CARD = { width: 176, height: 52 } as const;
const ACTOR = { width: 176, height: 40 } as const;
const ADAPTER = { width: 152, height: 44 } as const;
const GAP = 16;
/** Between the bands outside a hexagon, room for an arrow. */
const BAND_GAP = 40;
/** Between the rings inside one. */
const RING_GAP = 28;
/** How far a hexagon's top and bottom edges stand in from its sides. */
const HEX_INSET = 56;
/** Above the first ring: the module's name. */
const HEX_TOP = 56;
const HEX_BOTTOM = 36;
const CORE_INSET = 36;
const CORE_PAD = 32;
const CORE_COLUMNS = 3;
const COLUMN_GAP = 72;
const MIN_HEX_WIDTH = 320;

const actorId = (moduleId: string, actor: string) =>
  `actor:${moduleId}:${actor}`;
export const callerId = (portId: string) => `caller:${portId}`;
export const adapterInId = (portId: string) => `in:${portId}`;
export const adapterOutId = (portId: string) => `out:${portId}`;
export const hexagonId = (moduleId: string) => `hexagon:${moduleId}`;
const coreId = (moduleId: string) => `core:${moduleId}`;

export function layoutArchitecture(hexagons: Hexagon[]): ArchitectureLayout {
  const columns = hexagons.map(measure);
  const hexTop = ACTOR.height + BAND_GAP + ADAPTER.height + BAND_GAP;
  const nodes: LaidOutNode[] = [];
  const edges: LaidOutEdge[] = [];
  let left = 0;
  let bottom = 0;
  for (const column of columns) {
    const placed = placeColumn(column, left, hexTop);
    nodes.push(...placed.nodes);
    edges.push(...placed.edges);
    left += column.width + COLUMN_GAP;
    bottom = Math.max(bottom, placed.bottom);
  }
  return {
    nodes,
    edges,
    width: Math.max(0, left - COLUMN_GAP),
    height: bottom,
  };
}

/** One hexagon's sizes, worked out before anything is placed. */
interface Column {
  hexagon: Hexagon;
  /** Who drives it: each named actor once, then one unknown caller per port that names none. */
  drivers: { id: string; label: string; ports: string[]; known: boolean }[];
  coreColumns: number;
  coreRows: number;
  coreWidth: number;
  coreHeight: number;
  hexWidth: number;
  hexHeight: number;
  width: number;
}

const rowWidth = (count: number, width: number) =>
  count === 0 ? 0 : count * width + (count - 1) * GAP;

function measure(hexagon: Hexagon): Column {
  const { module, drivingPorts, applicationServices, domainCore } = hexagon;
  const drivers: Column['drivers'] = [];
  for (const { behaviour, actors } of drivingPorts) {
    if (actors.length === 0)
      drivers.push({
        id: callerId(behaviour.id),
        label: 'Another subsystem',
        ports: [behaviour.id],
        known: false,
      });
    for (const actor of actors) {
      const id = actorId(module.id, actor);
      const driver = drivers.find((known) => known.id === id);
      if (driver) driver.ports.push(behaviour.id);
      else
        drivers.push({ id, label: actor, ports: [behaviour.id], known: true });
    }
  }
  const coreColumns = Math.min(CORE_COLUMNS, domainCore.length);
  const coreRows = Math.ceil(domainCore.length / CORE_COLUMNS);
  const coreWidth =
    coreColumns === 0 ? 0 : rowWidth(coreColumns, CARD.width) + 2 * CORE_INSET;
  const coreHeight =
    coreRows === 0
      ? 0
      : coreRows * CARD.height + (coreRows - 1) * GAP + 2 * CORE_PAD;
  const content = Math.max(
    rowWidth(drivingPorts.length, CARD.width),
    rowWidth(applicationServices.length, CARD.width),
    rowWidth(hexagon.drivenPorts.length, CARD.width),
    coreWidth,
  );
  const hexWidth = Math.max(MIN_HEX_WIDTH, content + 2 * (HEX_INSET + GAP));
  const rings = [
    drivingPorts.length > 0 ? CARD.height : 0,
    applicationServices.length > 0 ? CARD.height : 0,
    coreHeight,
    hexagon.drivenPorts.length > 0 ? CARD.height : 0,
  ].filter((height) => height > 0);
  const hexHeight =
    HEX_TOP +
    rings.reduce((sum, height) => sum + height, 0) +
    Math.max(0, rings.length - 1) * RING_GAP +
    HEX_BOTTOM;
  return {
    hexagon,
    drivers,
    coreColumns,
    coreRows,
    coreWidth,
    coreHeight,
    hexWidth,
    hexHeight,
    width: Math.max(
      hexWidth,
      rowWidth(drivers.length, ACTOR.width),
      rowWidth(drivingPorts.length, ADAPTER.width),
    ),
  };
}

function placeColumn(
  column: Column,
  left: number,
  hexTop: number,
): { nodes: LaidOutNode[]; edges: LaidOutEdge[]; bottom: number } {
  const { hexagon } = column;
  const moduleId = hexagon.module.id;
  const centre = left + column.width / 2;
  const hexLeft = centre - column.hexWidth / 2;
  const nodes: LaidOutNode[] = [];
  const edges: LaidOutEdge[] = [];
  /** A row of equal cards, centred on the column. */
  const row = (count: number, width: number) => {
    const start = centre - rowWidth(count, width) / 2;
    return (index: number) => start + index * (width + GAP);
  };
  const card = (
    element: PlacedElement,
    kind: LaidOutKind,
    x: number,
    y: number,
  ) => {
    nodes.push({
      id: element.id,
      kind,
      x,
      y,
      ...CARD,
      label: element.name,
      element,
      selects: element.id,
    });
  };

  nodes.push({
    id: hexagonId(moduleId),
    kind: 'hexagon',
    x: hexLeft,
    y: hexTop,
    width: column.hexWidth,
    height: column.hexHeight,
    label: hexagon.module.name,
    element: null,
    selects: moduleId,
  });

  const driverAt = row(column.drivers.length, ACTOR.width);
  for (const [index, driver] of column.drivers.entries()) {
    nodes.push({
      id: driver.id,
      kind: driver.known ? 'actor' : 'caller',
      x: driverAt(index),
      y: 0,
      ...ACTOR,
      label: driver.label,
      element: null,
      selects: driver.id,
    });
    for (const port of driver.ports)
      edges.push({
        id: `${driver.id}->${adapterInId(port)}`,
        source: driver.id,
        target: adapterInId(port),
        kind: 'drives',
      });
  }

  let y = hexTop + HEX_TOP;
  const ports = hexagon.drivingPorts;
  if (ports.length > 0) {
    const portAt = row(ports.length, CARD.width);
    for (const [index, { behaviour, service }] of ports.entries()) {
      const x = portAt(index);
      card(behaviour, 'drivingPort', x, y);
      nodes.push({
        id: adapterInId(behaviour.id),
        kind: 'adapterIn',
        x: x + (CARD.width - ADAPTER.width) / 2,
        y: ACTOR.height + BAND_GAP,
        ...ADAPTER,
        label: 'in adapter',
        element: null,
        selects: adapterInId(behaviour.id),
      });
      edges.push({
        id: `${adapterInId(behaviour.id)}->${behaviour.id}`,
        source: adapterInId(behaviour.id),
        target: behaviour.id,
        kind: 'adapts',
      });
      // A service the reader has left out has no card to join the port to.
      if (hexagon.applicationServices.some(({ id }) => id === service))
        edges.push({
          id: `${behaviour.id}->${service}`,
          source: behaviour.id,
          target: service,
          kind: 'owns',
        });
    }
    y += CARD.height + RING_GAP;
  }

  const services = hexagon.applicationServices;
  if (services.length > 0) {
    const serviceAt = row(services.length, CARD.width);
    for (const [index, service] of services.entries())
      card(service, 'service', serviceAt(index), y);
    y += CARD.height + RING_GAP;
  }

  if (hexagon.domainCore.length > 0) {
    nodes.push({
      id: coreId(moduleId),
      kind: 'domainCore',
      x: centre - column.coreWidth / 2,
      y,
      width: column.coreWidth,
      height: column.coreHeight,
      label: 'Domain core',
      element: null,
      selects: moduleId,
    });
    for (const [index, element] of hexagon.domainCore.entries()) {
      const rowIndex = Math.floor(index / column.coreColumns);
      const inRow = Math.min(
        column.coreColumns,
        hexagon.domainCore.length - rowIndex * column.coreColumns,
      );
      const x = row(inRow, CARD.width)(index % column.coreColumns);
      card(
        element,
        'element',
        x,
        y + CORE_PAD + rowIndex * (CARD.height + GAP),
      );
    }
    y += column.coreHeight + RING_GAP;
  }

  const driven = hexagon.drivenPorts;
  const outTop = hexTop + column.hexHeight + BAND_GAP;
  if (driven.length > 0) {
    const drivenAt = row(driven.length, CARD.width);
    for (const [index, port] of driven.entries()) {
      const x = drivenAt(index);
      card(port, 'drivenPort', x, y);
      nodes.push({
        id: adapterOutId(port.id),
        kind: 'adapterOut',
        x: x + (CARD.width - ADAPTER.width) / 2,
        y: outTop,
        ...ADAPTER,
        label: 'out adapter',
        element: null,
        selects: adapterOutId(port.id),
      });
      edges.push({
        id: `${port.id}<-${adapterOutId(port.id)}`,
        source: port.id,
        target: adapterOutId(port.id),
        kind: 'implements',
      });
    }
  }

  return {
    nodes,
    edges,
    bottom: driven.length > 0 ? outTop + ADAPTER.height : outTop - BAND_GAP,
  };
}

/** The six corners of a hexagon of this size, for an SVG `points`. */
export const hexagonPoints = (
  width: number,
  height: number,
  inset: number = HEX_INSET,
) =>
  [
    [inset, 0],
    [width - inset, 0],
    [width, height / 2],
    [width - inset, height],
    [inset, height],
    [0, height / 2],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ');

export const CORE_HEX_INSET = CORE_INSET - 8;
