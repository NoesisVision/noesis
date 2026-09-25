/*
 * The shape a reader wants a model in: one tree, whatever it was rebuilt from.
 * A design document projects into it by folding its change sets together; the
 * scanned system model will project into the same nodes, so both are read
 * through one tree. The projections are the reader's, so they live here and
 * not on the server: the wire carries what the graph holds, and the tree is
 * rebuilt from it on the way to the page.
 *
 * The nodes come out flat and in pre-order, already sorted, because a node's
 * subtree is then the run of nodes after it that are deeper than it is.
 */

const OUTLINE_KINDS = [
  'module',
  'building_block',
  'behaviour',
  'property',
  'rule',
  'scenario',
] as const;
export type OutlineKind = (typeof OUTLINE_KINDS)[number];

/** What the design does to the element, or nothing when it only implies it. */
const OUTLINE_CHANGES = ['added', 'modified', 'removed', 'unchanged'] as const;
export type OutlineChange = (typeof OUTLINE_CHANGES)[number];

export interface OutlineNode {
  /** Unique within one outline: an element's id, or its owner's id and the part's name. */
  path: string;
  /** The parent's `path`; null for a node at the top of the tree. */
  parentPath: string | null;
  /** The id the graph knows the element by; null for a part, which has none. */
  elementId: string | null;
  kind: OutlineKind;
  /** The element's own name: `PaymentHold`, never `scheduling.payments.PaymentHold`. */
  name: string;
  /** 0 at the top. */
  depth: number;
  change: OutlineChange;
  /** The pattern as the model spells it: `application_service`, `Command`, `Consistency`. */
  pattern: string | null;
  /** The pattern as a reader types it, which is what a search matches against. */
  patternLabel: string | null;
  /** The description draws a diagram. */
  hasDiagram: boolean;
}

/**
 * The order a reader meets a module's building blocks in: what the outside
 * calls, then how instances come and go, then the boundary, then the model
 * itself, then the messages. Deliberately not alphabetical — the sequence is
 * how the design is taught, so it belongs with the model rather than with the
 * view that draws it.
 *
 * `external_integration` stands where a hexagonal port would; the model has no
 * port of its own.
 */
const BUILDING_BLOCK_READING_ORDER = [
  'application_service',
  'domain_service',
  'repository',
  'factory',
  'external_integration',
  'aggregate',
  'entity',
  'value_object',
  'domain_command',
  'domain_query',
  'domain_event',
] as const;

/** Submodules above the blocks they hold; rules and scenarios last of all. */
const KIND_ORDER: readonly OutlineKind[] = [
  'module',
  'building_block',
  'behaviour',
  'property',
  'rule',
  'scenario',
];

/** Past the end of both orders, so anything unplaced sorts after everything placed. */
const UNPLACED = Number.MAX_SAFE_INTEGER;

const indexIn = (order: readonly string[], value: string | null): number => {
  const index = value === null ? -1 : order.indexOf(value);
  return index === -1 ? UNPLACED : index;
};

/** `application_service` as a reader says it, so that typing it finds it. */
export function patternLabelOf(pattern: string | null): string | null {
  return pattern === null ? null : pattern.replaceAll('_', ' ');
}

/** The fence a diagram is written in, the one the reader draws. */
const MERMAID_FENCE = /^ {0,3}(?:`{3,}|~{3,})[^\n]*\bmermaid\b/mu;

export function drawsDiagram(description: string | null | undefined): boolean {
  return description ? MERMAID_FENCE.test(description) : false;
}

/**
 * The reading order is about building blocks; a property's pattern is its
 * type, which happens to share the vocabulary and must not reorder properties.
 */
const readingRankOf = (node: OutlineNode): number =>
  node.kind === 'building_block'
    ? indexIn(BUILDING_BLOCK_READING_ORDER, node.pattern)
    : 0;

/** Siblings only: the comparison says nothing about nodes in different parents. */
export function compareSiblings(a: OutlineNode, b: OutlineNode): number {
  return (
    indexIn(KIND_ORDER, a.kind) - indexIn(KIND_ORDER, b.kind) ||
    readingRankOf(a) - readingRankOf(b) ||
    a.name.localeCompare(b.name) ||
    a.path.localeCompare(b.path)
  );
}

/**
 * Sorts every parent's children and walks them depth first, stamping how deep
 * each one came out. Nodes whose parent is missing would be unreachable, so a
 * projection that produces one has failed to give an element its ancestors.
 */
export function inReadingOrder(nodes: Iterable<OutlineNode>): OutlineNode[] {
  const children = new Map<string | null, OutlineNode[]>();
  for (const node of nodes) {
    const siblings = children.get(node.parentPath);
    if (siblings) siblings.push(node);
    else children.set(node.parentPath, [node]);
  }
  for (const siblings of children.values()) siblings.sort(compareSiblings);

  const ordered: OutlineNode[] = [];
  const visit = (parentPath: string | null, depth: number) => {
    for (const node of children.get(parentPath) ?? []) {
      ordered.push({ ...node, depth });
      visit(node.path, depth + 1);
    }
  };
  visit(null, 0);
  return ordered;
}
