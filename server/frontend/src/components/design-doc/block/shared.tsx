import { useBlockNoteEditor, useEditorChange } from '@blocknote/react';
import * as React from 'react';
import { buildOutlineFromBlocks } from '@/components/design-doc/editor-outline';

export type RenderProps = {
  block: { id: string; type?: string; props: Record<string, unknown> };
  contentRef?: (node: HTMLElement | null) => void;
};

/* ---------------------------------------------------- section headings -- */

/**
 * The five fixed document sections (prototype numbering). They are a
 * rendering concern over the model, not blocks: the heading is drawn above
 * whichever block currently opens its section, so it survives reordering and
 * needs no undeletable heading block.
 */
const FIXED_SECTIONS: Record<string, { num: string; title: string }> = {
  goal: { num: '1', title: 'Goal' },
  contextParagraph: { num: '2', title: 'Business context' },
  outcome: { num: '3', title: 'Target outcomes' },
  scopeItem: { num: '4', title: 'Scope' },
  actor: { num: '5', title: 'Actors' },
};

/**
 * Anchor order for the "not written yet" line: an empty fixed section has no
 * block of its own to render from, so its heading and line are drawn above
 * the first block of the next section that does exist (the first bounded
 * context catches any trailing empty sections).
 */
const SECTION_ANCHOR_ORDER = [
  'goal',
  'contextParagraph',
  'outcome',
  'scopeItem',
  'actor',
  'contextHeading',
];

interface SectionMarkers {
  heading: boolean;
  scopeLabel: 'In scope' | 'Out of scope' | null;
  /** Empty fixed sections whose heading this block anchors. */
  missing: { num: string; title: string }[];
}

function computeMissingSections(
  blocks: { id: string; type: string }[],
  block: RenderProps['block'],
): SectionMarkers['missing'] {
  const type = block.type ?? '';
  const index = SECTION_ANCHOR_ORDER.indexOf(type);
  if (index === -1) return [];
  if (blocks.find((b) => b.type === type)?.id !== block.id) return [];
  const missing: SectionMarkers['missing'] = [];
  for (let i = index - 1; i >= 0; i--) {
    const earlier = SECTION_ANCHOR_ORDER[i];
    if (earlier === undefined || blocks.some((b) => b.type === earlier)) break;
    const section = FIXED_SECTIONS[earlier];
    if (section !== undefined) missing.unshift(section);
  }
  return missing;
}

function computeMarkers(
  blocks: { id: string; type: string; props: Record<string, unknown> }[],
  block: RenderProps['block'],
): SectionMarkers {
  const type = block.type ?? '';
  const firstOfSection = blocks.find((b) => b.type === type);
  let scopeLabel: SectionMarkers['scopeLabel'] = null;
  if (type === 'scopeItem') {
    const scope = block.props.scope === 'out' ? 'out' : 'in';
    const firstOfScope = blocks.find(
      (b) =>
        b.type === 'scopeItem' &&
        (b.props.scope === 'out' ? 'out' : 'in') === scope,
    );
    if (firstOfScope?.id === block.id) {
      scopeLabel = scope === 'out' ? 'Out of scope' : 'In scope';
    }
  }
  return {
    heading: firstOfSection?.id === block.id,
    scopeLabel,
    missing: computeMissingSections(blocks, block),
  };
}

/** The reading view's quiet line for detail that holds nothing yet. */
function NotWrittenLine({ children }: { children: React.ReactNode }) {
  return (
    <p
      contentEditable={false}
      className="select-none text-[13px] text-muted-foreground"
    >
      {children}
    </p>
  );
}

function SectionHeadingLine({ num, title }: { num: string; title: string }) {
  return (
    <h2 contentEditable={false} className="dd-sec select-none">
      <span className="mr-2.5 font-normal text-muted-foreground tabular-nums">
        {num}
      </span>
      {title}
    </h2>
  );
}

/** Draws the numbered section heading above the block that opens a section. */
function SectionFrame({
  block,
  children,
}: {
  block: RenderProps['block'];
  children: React.ReactNode;
}) {
  const editor = useBlockNoteEditor();
  const blocksOf = () =>
    editor.document as unknown as Parameters<typeof computeMarkers>[0];
  const [markers, setMarkers] = React.useState<SectionMarkers>(() =>
    computeMarkers(blocksOf(), block),
  );
  useEditorChange(() => setMarkers(computeMarkers(blocksOf(), block)), editor);

  const section = FIXED_SECTIONS[block.type ?? ''];
  return (
    <div className="w-full">
      {markers.missing.map((empty) => (
        <React.Fragment key={empty.num}>
          <SectionHeadingLine num={empty.num} title={empty.title} />
          <NotWrittenLine>Not written yet.</NotWrittenLine>
        </React.Fragment>
      ))}
      {markers.heading && section !== undefined && (
        <SectionHeadingLine num={section.num} title={section.title} />
      )}
      {markers.scopeLabel !== null && (
        <div
          contentEditable={false}
          className="dd-label select-none block-title bn-drag-exclude"
        >
          {markers.scopeLabel}
        </div>
      )}
      {children}
    </div>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: this module also exports the HeadingNum component; withSection is a renderer decorator shared across block files.
export const withSection =
  (inner: (props: RenderProps) => React.ReactNode) => (props: RenderProps) => (
    <SectionFrame block={props.block}>{inner(props)}</SectionFrame>
  );

/**
 * The position-derived number of a context / service / use-case heading —
 * the same outline the table of contents shows (6, 6.1, 6.1.1), recomputed
 * as blocks move so a reordered use case renumbers itself.
 */
export function HeadingNum({ blockId }: { blockId: string }) {
  const editor = useBlockNoteEditor();
  const compute = React.useCallback(
    () =>
      buildOutlineFromBlocks(
        editor.document as unknown as Parameters<
          typeof buildOutlineFromBlocks
        >[0],
      ).find((item) => item.id === blockId)?.num ?? '',
    [editor, blockId],
  );
  const [num, setNum] = React.useState(compute);
  useEditorChange(() => setNum(compute()), editor);

  if (num === '') return null;
  return (
    <span
      contentEditable={false}
      className="mr-2.5 select-none font-normal text-muted-foreground tabular-nums"
    >
      {num}
    </span>
  );
}

/* --------------------------------------------------- use-case group labels */

/**
 * The prototype's `.label`: DESCRIPTION, RULES, INPUT, OUTPUT, ACCEPTANCE
 * SCENARIOS, QUALITY ATTRIBUTES — printed once above the first element of
 * the group inside its use case, outside the editable area, and derived from
 * position so it follows insertions and reorders.
 */
function groupOf(block: {
  type: string;
  props: Record<string, unknown>;
}): { key: string; label: string } | null {
  const useCaseId = String(block.props.useCaseId ?? '');
  switch (block.type) {
    case 'useCaseDescription':
      return { key: `${useCaseId}:description`, label: 'Description' };
    case 'rule':
      return { key: `${useCaseId}:rules`, label: 'Rules' };
    case 'fieldRow':
      return block.props.direction === 'output'
        ? { key: `${useCaseId}:output`, label: 'Output' }
        : { key: `${useCaseId}:input`, label: 'Input' };
    case 'outputSummary':
      return { key: `${useCaseId}:output`, label: 'Output' };
    case 'scenario':
      return { key: `${useCaseId}:scenarios`, label: 'Acceptance scenarios' };
    case 'qualityAttribute':
      return { key: `${useCaseId}:quality`, label: 'Quality attributes' };
    default:
      return null;
  }
}

interface GroupInfo {
  /** Label to print above this block — only on the group's first block. */
  label: string | null;
  /** 1-based position inside the group (the rule list's number marker). */
  index: number;
}

function computeGroupInfo(
  blocks: { id: string; type: string; props: Record<string, unknown> }[],
  block: RenderProps['block'],
): GroupInfo {
  const own = groupOf({ type: block.type ?? '', props: block.props });
  if (own === null) return { label: null, index: 0 };
  let index = 0;
  let first = false;
  for (const candidate of blocks) {
    if (groupOf(candidate)?.key !== own.key) continue;
    index += 1;
    if (candidate.id === block.id) {
      first = index === 1;
      break;
    }
  }
  return { label: first ? own.label : null, index };
}

// biome-ignore lint/style/useComponentExportOnlyModules: this module also exports the HeadingNum component; useGroupInfo is a hook shared across block files.
export function useGroupInfo(block: RenderProps['block']): GroupInfo {
  const editor = useBlockNoteEditor();
  const compute = React.useCallback(
    () =>
      computeGroupInfo(
        editor.document as unknown as Parameters<typeof computeGroupInfo>[0],
        block,
      ),
    [editor, block],
  );
  const [info, setInfo] = React.useState<GroupInfo>(compute);
  useEditorChange(() => setInfo(compute()), editor);
  return info;
}

/** Wraps a render with its group label, kept outside the editable area. */
function GroupFrame({
  block,
  children,
}: {
  block: RenderProps['block'];
  children: React.ReactNode;
}) {
  const { label } = useGroupInfo(block);
  return (
    <div className="w-full">
      {label !== null && (
        <div
          contentEditable={false}
          className="dd-label select-none block-title bn-drag-exclude"
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: this module also exports the HeadingNum component; withGroup is a renderer decorator shared across block files.
export const withGroup =
  (inner: (props: RenderProps) => React.ReactNode) => (props: RenderProps) => (
    <GroupFrame block={props.block}>{inner(props)}</GroupFrame>
  );

/* ------------------------------------------- use-case "not written" line -- */

type UseCaseBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
};

/** The use case a block belongs to — its own id for the heading. */
function owningUseCaseId(block: {
  type?: string;
  id: string;
  props: Record<string, unknown>;
}): string {
  if (block.type === 'useCaseHeading') return block.id;
  const useCaseId = block.props.useCaseId;
  return typeof useCaseId === 'string' ? useCaseId : '';
}

/**
 * The parts of a use case that hold nothing yet, in the order the
 * specification fixes — the retired reading view's `missingSections`, now
 * computed from the live block list and anchored below the use case's last
 * block.
 */
function computeUseCaseMissing(
  blocks: UseCaseBlock[],
  block: RenderProps['block'],
): string[] {
  const useCaseId = owningUseCaseId(block);
  if (useCaseId === '') return [];
  const mine = blocks.filter((b) => owningUseCaseId(b) === useCaseId);
  if (mine[mine.length - 1]?.id !== block.id) return [];
  const has = (predicate: (b: UseCaseBlock) => boolean) => mine.some(predicate);
  const missing: string[] = [];
  if (!has((b) => b.type === 'useCaseSummary')) missing.push('summary');
  if (!has((b) => b.type === 'useCaseDescription')) missing.push('description');
  if (!has((b) => b.type === 'rule')) missing.push('rules');
  if (!has((b) => b.type === 'fieldRow' && b.props.direction === 'input')) {
    missing.push('input');
  }
  if (
    !has(
      (b) =>
        b.type === 'outputSummary' ||
        (b.type === 'fieldRow' && b.props.direction === 'output'),
    )
  ) {
    missing.push('output');
  }
  if (!has((b) => b.type === 'scenario')) missing.push('acceptance scenarios');
  if (!has((b) => b.type === 'qualityAttribute')) {
    missing.push('quality attributes');
  }
  return missing;
}

/** Prints the use case's "Not written yet: …" line below its last block. */
function UseCaseTailFrame({
  block,
  children,
}: {
  block: RenderProps['block'];
  children: React.ReactNode;
}) {
  const editor = useBlockNoteEditor();
  const compute = React.useCallback(
    () =>
      computeUseCaseMissing(
        editor.document as unknown as UseCaseBlock[],
        block,
      ),
    [editor, block],
  );
  const [missing, setMissing] = React.useState<string[]>(compute);
  useEditorChange(() => setMissing(compute()), editor);
  return (
    <div className="w-full">
      {children}
      {missing.length > 0 && (
        <div className="mt-3">
          <NotWrittenLine>Not written yet: {missing.join(', ')}</NotWrittenLine>
        </div>
      )}
    </div>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: this module also exports the HeadingNum component; withUseCaseTail is a renderer decorator shared across block files.
export const withUseCaseTail =
  (inner: (props: RenderProps) => React.ReactNode) => (props: RenderProps) => (
    <UseCaseTailFrame block={props.block}>{inner(props)}</UseCaseTailFrame>
  );

// biome-ignore lint/style/useComponentExportOnlyModules: this module also exports the HeadingNum component; inlineRender is a renderer decorator shared across block files.
export const inlineRender =
  (
    wrapper: (props: {
      block: RenderProps['block'];
      children: React.ReactNode;
    }) => React.ReactNode,
  ) =>
  (props: RenderProps) => (
    // `dd-editable` carries the prototype's per-element editing affordance
    // (hover hint, focus ring on the active element) — see the editor css.
    <div className="dd-editable">
      {wrapper({
        block: props.block,
        children: <span className="inline-content" ref={props.contentRef} />,
      })}
    </div>
  );
