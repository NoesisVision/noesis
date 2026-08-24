import { useBlockNoteEditor, useEditorChange } from '@blocknote/react';
import type {
  DesignDocBlockType,
  DesignedScenario,
} from '@repo/design-doc-blocks';
import { PlusIcon, XIcon } from 'lucide-react';
import * as React from 'react';
import { buildOutlineFromBlocks } from '@/components/design-doc/editor-outline';
import { cn } from '@/lib/utils';

/*
 * The typed BlockNote schema (plan §4): each block type maps to one
 * design-doc element, sharing its config — prop schema, content kind — with
 * the server's headless schema through @repo/design-doc-blocks. What may
 * exist in the document comes from these specs; what may be *inserted where*
 * comes from the slash menu in design-doc-editor.tsx.
 */

type RenderProps = {
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
/** The use-case type badge colours: command blue, query green, event orange. */
const TYPE_BADGE_CLASSES: Record<string, string> = {
  Command: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  Query: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  Event:
    'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
};

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
        <div contentEditable={false} className="dd-label select-none">
          {markers.scopeLabel}
        </div>
      )}
      {children}
    </div>
  );
}

const withSection =
  (inner: (props: RenderProps) => React.ReactNode) => (props: RenderProps) => (
    <SectionFrame block={props.block}>{inner(props)}</SectionFrame>
  );

/**
 * The position-derived number of a context / service / use-case heading —
 * the same outline the table of contents shows (6, 6.1, 6.1.1), recomputed
 * as blocks move so a reordered use case renumbers itself.
 */
function HeadingNum({ blockId }: { blockId: string }) {
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

function useGroupInfo(block: RenderProps['block']): GroupInfo {
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
        <div contentEditable={false} className="dd-label select-none">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

const withGroup =
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

const withUseCaseTail =
  (inner: (props: RenderProps) => React.ReactNode) => (props: RenderProps) => (
    <UseCaseTailFrame block={props.block}>{inner(props)}</UseCaseTailFrame>
  );

/** A rule's `1.` marker — its position in the use case's rule list. */
function RuleMarker({ block }: { block: RenderProps['block'] }) {
  const { index } = useGroupInfo(block);
  return (
    <span
      contentEditable={false}
      className="mr-2 select-none text-[13px] text-muted-foreground tabular-nums"
    >
      {index}.
    </span>
  );
}

const inlineRender =
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

/** The visual per type, mirroring the reading view's typography. */
// biome-ignore lint/style/useComponentExportOnlyModules: a map of block renders is what the schema factory consumes; each entry is itself a component.
export const RENDERERS: Record<
  DesignDocBlockType,
  (props: RenderProps) => React.ReactNode
> = {
  goal: withSection(
    inlineRender(({ children }) => (
      <div className="text-[17px] leading-relaxed">{children}</div>
    )),
  ),
  contextParagraph: withSection(
    inlineRender(({ children }) => (
      <p className="my-0.5 whitespace-pre-wrap">{children}</p>
    )),
  ),
  outcome: withSection(
    inlineRender(({ block, children }) => (
      <div className="pl-4">
        <span
          contentEditable={false}
          className="mr-2 select-none text-muted-foreground"
        >
          •
        </span>
        {children}
        {typeof block.props.measure === 'string' &&
          block.props.measure !== '' && (
            <span
              contentEditable={false}
              className="ml-2 select-none text-[13px] text-muted-foreground"
            >
              measure: {block.props.measure}
            </span>
          )}
      </div>
    )),
  ),
  scopeItem: withSection(
    inlineRender(({ block, children }) => (
      <div className="pl-4">
        <span
          contentEditable={false}
          className={cn(
            'mr-2 select-none rounded px-1 text-[10px] font-semibold uppercase',
            block.props.scope === 'out'
              ? 'bg-secondary text-muted-foreground'
              : 'bg-secondary text-secondary-foreground',
          )}
        >
          {block.props.scope === 'out' ? 'out' : 'in'}
        </span>
        {children}
      </div>
    )),
  ),
  actor: withSection(
    inlineRender(({ block, children }) => (
      <div className="pl-4">
        <span
          contentEditable={false}
          className="mr-2 select-none text-muted-foreground"
        >
          •
        </span>
        <strong className="font-semibold">{children}</strong>
        <span
          contentEditable={false}
          className="ml-2 select-none text-[13px] text-muted-foreground"
        >
          — {block.props.kind === 'system' ? 'external system' : 'human role'}
          {typeof block.props.description === 'string' &&
            block.props.description !== '' &&
            ` · ${block.props.description}`}
        </span>
      </div>
    )),
  ),
  // withSection so the first context anchors any trailing empty fixed
  // sections' "not written yet" headings (it draws no heading of its own).
  contextHeading: withSection(
    inlineRender(({ block, children }) => (
      <h2 className="dd-sec">
        <HeadingNum blockId={block.id} />
        {children}
        <span
          contentEditable={false}
          className="ml-2 select-none align-middle text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
        >
          context
        </span>
      </h2>
    )),
  ),
  serviceHeading: inlineRender(({ block, children }) => (
    <h3 className="dd-sec">
      <HeadingNum blockId={block.id} />
      {children}
    </h3>
  )),
  useCaseHeading: withUseCaseTail(
    inlineRender(({ block, children }) => (
      <h4 className="dd-sec">
        <HeadingNum blockId={block.id} />
        {children}
        {typeof block.props.type === 'string' && block.props.type !== '' && (
          <span
            contentEditable={false}
            className={cn(
              'ml-2 inline-block select-none rounded px-1.5 align-middle text-[10.5px] font-semibold tracking-wide uppercase',
              TYPE_BADGE_CLASSES[block.props.type] ??
                'bg-secondary text-secondary-foreground',
            )}
          >
            {block.props.type}
          </span>
        )}
      </h4>
    )),
  ),
  useCaseSummary: withUseCaseTail(
    inlineRender(({ children }) => (
      <div className="text-[16px] leading-relaxed">{children}</div>
    )),
  ),
  useCaseDescription: withUseCaseTail(
    withGroup(
      inlineRender(({ children }) => (
        <div className="whitespace-pre-wrap">{children}</div>
      )),
    ),
  ),
  rule: withUseCaseTail(
    withGroup(
      inlineRender(({ block, children }) => (
        <div className="pl-4">
          <RuleMarker block={block} />
          {children}
        </div>
      )),
    ),
  ),
  fieldRow: withUseCaseTail(withGroup((props) => <FieldRowBlock {...props} />)),
  outputSummary: withUseCaseTail(
    withGroup(inlineRender(({ children }) => <div>{children}</div>)),
  ),
  scenario: withUseCaseTail(
    withGroup((props) => <ScenarioBlock {...(props as ScenarioRenderProps)} />),
  ),
  qualityAttribute: withUseCaseTail(
    withGroup(
      inlineRender(({ block, children }) => (
        <div className="pl-4">
          <span
            contentEditable={false}
            className="mr-2 select-none text-muted-foreground"
          >
            •
          </span>
          {typeof block.props.name === 'string' && block.props.name !== '' && (
            <strong
              contentEditable={false}
              className="mr-1 select-none font-semibold"
            >
              {block.props.name}:
            </strong>
          )}
          {children}
        </div>
      )),
    ),
  ),
};

/** A prop-backed input that grows with its value, styled as plain text. */
function PropInput({
  value,
  placeholder,
  onChange,
  className,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <input
      className={cn(
        'rounded border bg-transparent px-1 py-0 hover:border-border focus:border-primary focus:outline-none',
        className,
      )}
      size={Math.max(value.length, placeholder.length, 4)}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * One typed field row: the business label is the inline content; the
 * structural half — `name: Type` — and the note are props, edited through
 * inputs so both wordings stay writable (plan §3.4).
 */
export function FieldRowBlock({ block, contentRef }: RenderProps) {
  const editor = useBlockNoteEditor();
  const set = (patch: Record<string, string>) => {
    editor.updateBlock(block as never, { props: patch } as never);
  };
  return (
    <div className="dd-editable flex items-baseline gap-3 border-b border-border py-1 text-sm">
      <span className="min-w-44 font-medium" ref={contentRef} />
      <span
        contentEditable={false}
        className="flex items-baseline font-mono text-xs text-muted-foreground"
      >
        <PropInput
          value={String(block.props.name ?? '')}
          placeholder="name"
          onChange={(value) => set({ name: value })}
        />
        :
        <PropInput
          value={String(block.props.fieldType ?? '')}
          placeholder="Type"
          onChange={(value) => set({ fieldType: value })}
        />
      </span>
      <span
        contentEditable={false}
        className="text-[13px] text-muted-foreground"
      >
        <PropInput
          value={String(block.props.note ?? '')}
          placeholder="note"
          onChange={(value) => set({ note: value })}
        />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- scenario -- */

interface ScenarioRenderProps {
  block: { id: string; props: Record<string, unknown> };
  editor: {
    updateBlock: (
      block: { id: string },
      update: { props: Record<string, string> },
    ) => unknown;
  };
}

function parseScenarioData(props: Record<string, unknown>): DesignedScenario {
  try {
    const raw = JSON.parse(
      String(props.data ?? '{}'),
    ) as Partial<DesignedScenario>;
    return {
      id: '',
      title: raw.title ?? '',
      kind: raw.kind === 'scenarioOutline' ? 'scenarioOutline' : 'scenario',
      tags: raw.tags ?? [],
      background: raw.background ?? [],
      steps: raw.steps ?? [],
      examples: raw.examples ?? null,
    };
  } catch {
    return {
      id: '',
      title: '',
      kind: 'scenario',
      tags: [],
      background: [],
      steps: [],
      examples: null,
    };
  }
}

const newStepId = () => `st-${crypto.randomUUID().slice(0, 8)}`;

/**
 * The scenario block: Gherkin below block granularity, so steps and example
 * rows live in the `data` prop (ids included, decision 51.7) and are edited
 * through this structured form rather than as free text.
 */
export function ScenarioBlock({ block, editor }: ScenarioRenderProps) {
  const scenario = parseScenarioData(block.props);
  const save = (next: DesignedScenario) => {
    editor.updateBlock(block, {
      props: { data: JSON.stringify({ ...next, id: block.id }) },
    });
  };

  const stepRow = (
    step: DesignedScenario['steps'][number],
    list: 'background' | 'steps',
  ) => (
    <div key={step.id} className="flex items-center gap-2">
      <select
        className="w-20 rounded border border-border bg-card px-1 py-0.5 text-right font-semibold text-primary cursor-pointer hover:bg-accent hover:text-sidebar-accent-foreground hover:border-accent focus:outline-none"
        value={step.keyword}
        onChange={(event) =>
          save({
            ...scenario,
            [list]: scenario[list].map((s) =>
              s.id === step.id
                ? { ...s, keyword: event.target.value as typeof s.keyword }
                : s,
            ),
          })
        }
      >
        {['Given', 'When', 'Then', 'And', 'But'].map((keyword) => (
          <option key={keyword}>{keyword}</option>
        ))}
      </select>
      <input
        className="flex-1 rounded border bg-transparent px-1 py-0.5 hover:border-border focus:border-primary focus:outline-none"
        value={step.text}
        onChange={(event) =>
          save({
            ...scenario,
            [list]: scenario[list].map((s) =>
              s.id === step.id ? { ...s, text: event.target.value } : s,
            ),
          })
        }
      />
      <button
        type="button"
        aria-label="Remove step"
        className="rounded p-0.5 text-muted-foreground hover:bg-accent"
        onClick={() =>
          save({
            ...scenario,
            [list]: scenario[list].filter((s) => s.id !== step.id),
          })
        }
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );

  const addStep = (list: 'background' | 'steps') =>
    save({
      ...scenario,
      [list]: [
        ...scenario[list],
        { id: newStepId(), keyword: 'Given' as const, text: '' },
      ],
    });

  return (
    <div
      contentEditable={false}
      className="dd-editable my-1 w-full border border-border p-3 text-sm"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          {scenario.kind === 'scenarioOutline'
            ? 'Scenario outline'
            : 'Scenario'}
        </span>
        <input
          className="flex-1 rounded border bg-transparent px-1 py-0.5 font-medium hover:border-border focus:border-primary focus:outline-none"
          placeholder="Scenario title"
          value={scenario.title}
          onChange={(event) => save({ ...scenario, title: event.target.value })}
        />
      </div>
      {scenario.background.length > 0 && (
        <div className="mt-1">
          <div className="text-[10px] tracking-wider text-muted-foreground uppercase">
            Background
          </div>
          {scenario.background.map((step) => stepRow(step, 'background'))}
        </div>
      )}
      <div className="mt-1 space-y-0.5">
        {scenario.steps.map((step) => stepRow(step, 'steps'))}
      </div>
      <button
        type="button"
        className="mt-1 flex items-center gap-1 rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent cursor-pointer"
        onClick={() => addStep('steps')}
      >
        <PlusIcon className="size-3" /> step
      </button>
      {scenario.examples !== null && (
        <table className="mt-1 border-collapse text-[13px]">
          <thead>
            <tr>
              {scenario.examples.headers.map((header) => (
                <th
                  key={header}
                  className="border border-border bg-secondary px-2 py-0.5 text-left font-medium"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenario.examples.rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={`${row.id}-${scenario.examples?.headers[cellIndex] ?? cellIndex}`}
                    className="border px-1 py-0.5 focus-within:border-b-primary"
                  >
                    <input
                      className="w-24 bg-transparent focus:outline-none"
                      value={cell}
                      onChange={(event) => {
                        const examples = scenario.examples;
                        if (examples === null) return;
                        save({
                          ...scenario,
                          examples: {
                            ...examples,
                            rows: examples.rows.map((r, i) =>
                              i === rowIndex
                                ? {
                                    ...r,
                                    cells: r.cells.map((c, j) =>
                                      j === cellIndex ? event.target.value : c,
                                    ),
                                  }
                                : r,
                            ),
                          },
                        });
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
