/*
 * The block-type configurations both BlockNote schemas are built from: the
 * frontend pairs them with React renders, the backend with placeholder
 * renders for headless conversion. Only this config shapes the ProseMirror
 * schema — the render never does — so sharing it is what keeps the two sides
 * producing the same document structure.
 *
 * Prop values in BlockNote are primitives; list- and object-valued fields
 * (actor ids, a scenario's steps) travel as JSON strings. Elements below
 * block granularity keep their ids inside that JSON (decision 51.7).
 */

import type { DesignDocBlockType } from './blocks.js';

export interface DesignDocPropSpec {
  default: string;
  values?: readonly string[];
}

export interface DesignDocBlockSpec {
  content: 'inline' | 'none';
  props: Record<string, DesignDocPropSpec>;
  /** Wording for menus: "context paragraph", "rule", ... */
  label: string;
  /**
   * The reorder group (prototype's `data-group`): blocks may only be dragged
   * among siblings of the same group. `null` marks a block with a fixed place
   * in the schema. Use-case-scoped groups are per use case — the projection
   * scopes them by the `useCaseId` prop.
   */
  group: string | null;
  /** Whether the schema allows the element to be absent (deletable). */
  removable: boolean;
}

const author = { default: 'human', values: ['human', 'agent'] } as const;

export const DESIGN_DOC_BLOCK_SPECS: Record<
  DesignDocBlockType,
  DesignDocBlockSpec
> = {
  goal: {
    content: 'inline',
    props: {},
    label: 'goal',
    group: null,
    removable: false,
  },
  contextParagraph: {
    content: 'inline',
    props: {},
    label: 'context paragraph',
    group: 'businessContext',
    removable: true,
  },
  outcome: {
    content: 'inline',
    props: { measure: { default: '' } },
    label: 'target outcome',
    group: 'outcomes',
    removable: true,
  },
  scopeItem: {
    content: 'inline',
    props: { scope: { default: 'in', values: ['in', 'out'] } },
    label: 'scope item',
    group: 'scope',
    removable: true,
  },
  actor: {
    content: 'inline',
    props: {
      kind: { default: 'human', values: ['human', 'system'] },
      description: { default: '' },
    },
    label: 'actor',
    group: 'actors',
    removable: true,
  },
  contextHeading: {
    content: 'inline',
    props: { description: { default: '' } },
    label: 'bounded context',
    group: null,
    removable: false,
  },
  serviceHeading: {
    content: 'inline',
    props: {
      boundedContextId: { default: '' },
      domainModuleId: { default: '' },
      description: { default: '' },
    },
    label: 'application service',
    group: null,
    removable: false,
  },
  useCaseHeading: {
    content: 'inline',
    props: {
      type: { default: '', values: ['', 'Command', 'Query', 'Event'] },
      applicationServiceId: { default: '' },
      behaviourId: { default: '' },
      actorIds: { default: '[]' },
    },
    label: 'use case',
    group: null,
    removable: false,
  },
  useCaseSummary: {
    content: 'inline',
    props: { useCaseId: { default: '' } },
    label: 'summary',
    group: null,
    removable: true,
  },
  useCaseDescription: {
    content: 'inline',
    props: { useCaseId: { default: '' }, author },
    label: 'description',
    group: null,
    removable: true,
  },
  rule: {
    content: 'inline',
    props: {
      useCaseId: { default: '' },
      ruleType: {
        default: '',
        values: ['', 'Consistency', 'Structure', 'Computation', 'State change'],
      },
      author,
    },
    label: 'rule',
    group: 'rules',
    removable: true,
  },
  fieldRow: {
    content: 'inline',
    props: {
      useCaseId: { default: '' },
      direction: { default: 'input', values: ['input', 'output'] },
      name: { default: '' },
      fieldType: { default: '' },
      note: { default: '' },
    },
    label: 'field',
    group: 'fields',
    removable: true,
  },
  outputSummary: {
    content: 'inline',
    props: { useCaseId: { default: '' } },
    label: 'output summary',
    group: null,
    removable: true,
  },
  scenario: {
    content: 'none',
    props: { useCaseId: { default: '' }, data: { default: '{}' } },
    label: 'acceptance scenario',
    group: 'scenarios',
    removable: true,
  },
  qualityAttribute: {
    content: 'inline',
    props: {
      useCaseId: { default: '' },
      name: { default: '' },
      qaType: {
        default: '',
        values: ['', 'performance', 'availability', 'security', 'other'],
      },
      author,
    },
    label: 'quality attribute',
    group: 'quality',
    removable: true,
  },
};

/**
 * The reorder group of a concrete block, scoped per use case where the spec
 * group is use-case-owned. The prototype's rule verbatim: drag reorders only
 * inside the schema array the block belongs to.
 */
export function blockGroup(
  type: DesignDocBlockType,
  props: Record<string, string | number | boolean>,
): string | null {
  const spec = DESIGN_DOC_BLOCK_SPECS[type];
  if (spec.group === null) return null;
  const useCaseId = props.useCaseId;
  const scoped =
    typeof useCaseId === 'string' && useCaseId !== ''
      ? `${useCaseId}:${spec.group}`
      : spec.group;
  // Input and output field lists are separate schema arrays.
  if (type === 'fieldRow') return `${scoped}:${String(props.direction)}`;
  // In-scope and out-of-scope are separate schema arrays.
  if (type === 'scopeItem') return `${scoped}:${String(props.scope)}`;
  return scoped;
}
