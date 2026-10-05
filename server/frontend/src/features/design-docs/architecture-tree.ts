import {
  BARE_ROW,
  type OutlineNode,
  patternLabelOf,
} from '#/shared/ui/model-tree/model-outline.ts';
import {
  type ArchitectureCheck,
  type ArchitectureOutline,
  elementsOf,
  LEVEL_LABEL,
  type PlacedElement,
} from './architecture-outline.ts';
import { needNameOf, needPath } from './design-doc-requirements.ts';
import { kindOf, nameOf } from './element-id.ts';

/*
 * The architecture as a tree beside the hexagons: the checks with the
 * elements each concerns, then the needs with the driving ports that answer
 * them. An element under two checks is a row under each, so a row's path is
 * where it sits; the element it names is its `elementId`.
 */

export const CHECKS_PATH = 'checks';
const NEEDS_PATH = 'needs';

export const checkPath = (check: ArchitectureCheck) =>
  `${CHECKS_PATH}/check:${check.id}`;
export const needAtPortsPath = (needId: string) => needPath(needId, NEEDS_PATH);

export function architectureTreeOf(
  outline: ArchitectureOutline,
  addedNeeds: ReadonlySet<string>,
): OutlineNode[] {
  const placed = placedById(outline);
  const modules = new Map(
    outline.hexagons.map(({ module }) => [module.id, module.name]),
  );
  const nodes: OutlineNode[] = [];
  const elementRow = (id: string, under: string) => {
    const element = placed.get(id);
    const pattern = element?.pattern ?? null;
    nodes.push({
      path: `${under}/${id}`,
      parentPath: under,
      elementId: id,
      kind: kindOf(id),
      name: element?.name ?? modules.get(id) ?? nameOf(id),
      depth: 2,
      change: element?.change ?? 'unchanged',
      pattern,
      patternLabel: patternLabelOf(pattern),
      hasDiagram: false,
    });
  };

  nodes.push({
    ...BARE_ROW,
    path: CHECKS_PATH,
    parentPath: null,
    kind: 'group',
    name: 'Checks',
  });
  for (const check of outline.checks) {
    const path = checkPath(check);
    nodes.push({
      ...BARE_ROW,
      path,
      parentPath: CHECKS_PATH,
      kind: 'check',
      name: check.title,
      depth: 1,
      pattern: check.level,
      patternLabel: LEVEL_LABEL[check.level],
    });
    for (const id of check.elementIds) elementRow(id, path);
  }

  nodes.push({
    ...BARE_ROW,
    path: NEEDS_PATH,
    parentPath: null,
    kind: 'group',
    name: 'Needs at the ports',
  });
  for (const { need, ports } of outline.needsAtPorts) {
    const path = needAtPortsPath(need.id);
    nodes.push({
      ...BARE_ROW,
      path,
      parentPath: NEEDS_PATH,
      kind: 'need',
      name: needNameOf(need),
      depth: 1,
      change: addedNeeds.has(need.id) ? 'added' : 'modified',
    });
    for (const id of ports) elementRow(id, path);
  }
  return nodes;
}

/**
 * What a reader who has opened nothing sees: both groups, every need, and the
 * checks that found something open on what they concern. A pass lists what it
 * looked at, which is worth reading only when asked for.
 */
export function defaultArchitectureExpansion(
  outline: ArchitectureOutline,
): Set<string> {
  return new Set([
    CHECKS_PATH,
    NEEDS_PATH,
    ...outline.checks.filter(({ level }) => level !== 'pass').map(checkPath),
    ...outline.needsAtPorts.map(({ need }) => needAtPortsPath(need.id)),
  ]);
}

/** Every element the hexagons draw, and the ones they cannot place, by id. */
function placedById(outline: ArchitectureOutline): Map<string, PlacedElement> {
  return new Map(
    [...outline.hexagons.flatMap(elementsOf), ...outline.unplaced].map(
      (element) => [element.id, element],
    ),
  );
}
