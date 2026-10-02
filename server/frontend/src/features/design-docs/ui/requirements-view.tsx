import { IconAlertCircle, IconChevronRight } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import {
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import type { OutlineKind } from '#/shared/ui/model-tree/model-outline.ts';
import { expansionMemory } from '#/shared/ui/model-tree/outline-memory.ts';
import { revealRow } from '#/shared/ui/model-tree/reveal-row.ts';
import {
  type SelectSource,
  useModelTree,
} from '#/shared/ui/model-tree/use-model-tree.ts';
import type {
  DesignedNeedInput,
  DesignedRuleInput,
} from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../design-doc-field.ts';
import {
  DESIGN_DECISIONS_PATH,
  needPath,
  type RequirementsOutline,
  type RequirementsSummary,
  requirementsOf,
  requirementsTreeOf,
  rulePath,
  type TracedRule,
  UNADDRESSED_NEEDS_PATH,
} from '../design-doc-requirements.ts';
import type { DesignDocDetail } from '../design-docs.api.ts';
import { Columns } from './columns.tsx';
import { DesignDocSurface } from './design-doc-surface.tsx';
import { ScenarioColumn } from './element-details/body/scenario-column.tsx';
import { scenarioEntriesOf } from './element-details/body/scenarios-of.ts';
import { ChangeBadge } from './element-details/change-badge.tsx';
import { OutlineSearchBox } from './outline-search-box.tsx';
import { Outline } from './outline.tsx';
import classes from './requirements-view.module.css';

/*
 * The design read as a requirements document: each need with the rules that
 * answer it, then the rules no need asks for and the needs nothing answers.
 * A rule reads first as a review checks it — what it says and what verifies
 * it; where it lives and why sits in its details, a click away.
 *
 * It stands in the same frame as the model: the needs and their rules as a
 * tree on the left, the document on the right, and the row in hand brings its
 * entry into view. Where the reader is lives in the address under names of
 * its own, so the model keeps its place while the requirements are read.
 *
 * The page heading is the document's; a need or a section is an `h2`, a rule
 * or an unanswered need an `h3`, and a rule's scenarios an `h4`.
 *
 * Mount it under the document's id, as the model's workbench is.
 */
export function RequirementsView({
  changeId,
  detail,
  switcher,
  selected: addressed,
  query,
  onSelect,
  onQuery,
}: {
  changeId: string;
  detail: DesignDocDetail;
  /** The control that switches to the model, in the header as the model has it. */
  switcher?: ReactNode;
} & RequirementsPlace) {
  const doc = detail.document;
  const requirements = useMemo(() => requirementsOf(doc), [doc]);
  const nodes = useMemo(
    () => requirementsTreeOf(requirements, doc),
    [requirements, doc],
  );
  const memory = useMemo(
    () => expansionMemory(`noesis.designDocs.${doc.id}.requirements.expanded`),
    [doc.id],
  );
  const page = useRef<HTMLDivElement>(null);
  const outlineBody = useRef<HTMLDivElement>(null);
  /* The row the reader picked in the tree, which the tree must not answer by
     scrolling: it is already under their eye. */
  const picked = useRef<string | null>(null);
  const onTreeSelect = useCallback(
    (path: string, source: SelectSource) => {
      if (source === 'tree') picked.current = path;
      onSelect(path, source);
    },
    [onSelect],
  );
  const controller = useModelTree(nodes, {
    selected: addressed,
    onSelect: onTreeSelect,
    query,
    onQuery,
    memory,
    excludeKinds: NO_KINDS,
  });
  /*
   * The document and the tree follow the reading position, however it moved:
   * a row picked, a link into the middle of the requirements, Back or Forward.
   * The tree is scrolled to everything but the row clicked in it.
   *
   * Opened on an address that names no row, the reader is at the top of the
   * document; the row the tree opens at says where they are and moves nothing.
   */
  const at = controller.selected;
  const top = useRef(addressed === null ? at : null);
  useEffect(() => {
    const own = picked.current === at;
    picked.current = null;
    if (at === null || at === top.current) return;
    top.current = null;
    revealEntry(page.current, at);
    if (!own) revealRow(outlineBody.current, at);
  }, [at]);

  return (
    <DesignDocSurface document={doc} switcher={switcher}>
      <Columns
        search={<OutlineSearchBox controller={controller} />}
        outline={
          <Outline
            controller={controller}
            empty={nodes.length === 0}
            label="Requirements outline"
          />
        }
        outlineRef={outlineBody}
        detail={
          <RequirementsDocument
            ref={page}
            changeId={changeId}
            document={doc}
            requirements={requirements}
            selected={at}
          />
        }
      />
    </DesignDocSurface>
  );
}

/** Where the reader is in the requirements and what they are looking for, as the address has it. */
export interface RequirementsPlace {
  /** The row in hand; null for the top. */
  selected: string | null;
  query: string;
  onSelect: (path: string, source: SelectSource) => void;
  onQuery: (query: string) => void;
}

/** Rules are the rows here, so the tree leaves nothing out. */
const NO_KINDS: readonly OutlineKind[] = [];

/**
 * Brings the entry a row names to the top of the document. A tick later, as
 * the tree's own reveal does, so the move lands after the render it caused;
 * how it scrolls is the pane's stylesheet's to say.
 */
function revealEntry(within: HTMLElement | null, path: string): void {
  setTimeout(() => {
    for (const entry of within?.querySelectorAll<HTMLElement>('[data-entry]') ??
      []) {
      if (entry.dataset.entry !== path) continue;
      entry.scrollIntoView({ block: 'start' });
      return;
    }
  }, 0);
}

function RequirementsDocument({
  ref,
  changeId,
  document: doc,
  requirements,
  selected,
}: {
  ref: Ref<HTMLDivElement>;
  changeId: string;
  document: DesignDocDetail['document'];
  requirements: RequirementsOutline;
  selected: string | null;
}) {
  const entry = (traced: TracedRule, under: string) => {
    const path = rulePath(traced, under);
    return (
      <RuleEntry
        key={path}
        path={path}
        selected={selected === path}
        traced={traced}
        changeId={changeId}
        docId={doc.id}
      />
    );
  };
  const mark = (path: string) => ({
    'data-entry': path,
    'data-selected': selected === path || undefined,
  });

  return (
    <div ref={ref} className={classes.page}>
      {doc.description !== '' && (
        <Text className={classes.intro}>{doc.description}</Text>
      )}
      <Summary summary={requirements.summary} />

      {requirements.needs.map(({ need, rules }) => (
        <section
          key={need.id}
          className={classes.section}
          {...mark(needPath(need))}
        >
          <div className={classes.sectionHead}>
            <Title order={2} size="h3">
              {valueOf(need.name) ?? need.id}
            </Title>
            <NeedBody need={need} />
          </div>
          {rules.length > 0 ? (
            rules.map((traced) => entry(traced, needPath(need)))
          ) : (
            <Text className={classes.empty}>
              No rule of this design answers this need.
            </Text>
          )}
        </section>
      ))}

      <section className={classes.section} {...mark(DESIGN_DECISIONS_PATH)}>
        <div className={classes.sectionHead}>
          <Title order={2} size="h3">
            Design decisions
          </Title>
          <Text className={classes.note}>
            Rules the design adds that no need asks for.
          </Text>
        </div>
        {requirements.designDecisions.length > 0 ? (
          requirements.designDecisions.map((traced) =>
            entry(traced, DESIGN_DECISIONS_PATH),
          )
        ) : (
          <Text className={classes.empty}>
            Every rule of this design answers a need.
          </Text>
        )}
      </section>

      <section className={classes.section} {...mark(UNADDRESSED_NEEDS_PATH)}>
        <div
          className={classes.sectionHead}
          data-gap={requirements.unaddressedNeeds.length > 0 || undefined}
        >
          <Title order={2} size="h3">
            Unaddressed needs
          </Title>
          <Text className={classes.note}>
            Needs no rule of this design traces to.
          </Text>
        </div>
        {requirements.unaddressedNeeds.length > 0 ? (
          requirements.unaddressedNeeds.map((need) => (
            <div
              key={need.id}
              className={classes.rule}
              {...mark(needPath(need, UNADDRESSED_NEEDS_PATH))}
            >
              <Title order={3} size="h5">
                {valueOf(need.name) ?? need.id}
              </Title>
              <NeedBody need={need} />
            </div>
          ))
        ) : (
          <Text className={classes.empty}>
            Every need has a rule that answers it.
          </Text>
        )}
      </section>
    </div>
  );
}

const SUMMARY: {
  key: keyof RequirementsSummary;
  one: string;
  many: string;
  gap?: true;
}[] = [
  { key: 'needs', one: 'need', many: 'needs' },
  { key: 'rules', one: 'rule', many: 'rules' },
  { key: 'designDecisions', one: 'design decision', many: 'design decisions' },
  {
    key: 'unaddressedNeeds',
    one: 'unaddressed need',
    many: 'unaddressed needs',
    gap: true,
  },
  {
    key: 'rulesWithoutVerification',
    one: 'rule without verification',
    many: 'rules without verification',
    gap: true,
  },
];

/** The counts a reviewer reads first; a gap above zero is marked by an icon as well as colour. */
function Summary({ summary }: { summary: RequirementsSummary }) {
  return (
    <ul className={classes.summary}>
      {SUMMARY.map(({ key, one, many, gap }) => {
        const count = summary[key];
        const marked = gap === true && count > 0;
        return (
          <li key={key} data-gap={marked || undefined}>
            {marked && <IconAlertCircle size={14} aria-hidden />}
            <b>{count}</b> {count === 1 ? one : many}
          </li>
        );
      })}
    </ul>
  );
}

function NeedBody({ need }: { need: DesignedNeedInput }) {
  const statement = valueOf(need.statement);
  const stakeholder = valueOf(need.stakeholder);
  return (
    <>
      {statement !== null && (
        <blockquote className={classes.quote}>{statement}</blockquote>
      )}
      {stakeholder !== null && (
        <Text className={classes.meta}>
          Stakeholder: <b>{stakeholder}</b>
        </Text>
      )}
    </>
  );
}

interface RuleEntryProps {
  traced: TracedRule;
  changeId: string;
  docId: string;
}

function RuleEntry({
  path,
  selected,
  traced,
  changeId,
  docId,
}: RuleEntryProps & { path: string; selected: boolean }) {
  const element = (
    <ElementLink traced={traced} changeId={changeId} docId={docId} />
  );
  const mark = {
    'data-entry': path,
    'data-selected': selected || undefined,
  };
  if (traced.change === 'removed')
    return (
      <div className={classes.rule} {...mark}>
        <RuleHead name={traced.name} change="removed" />
        <dl className={classes.fields}>
          <dt>Subsystem</dt>
          <dd>{traced.module.name}</dd>
          <dt>Element</dt>
          <dd>{element}</dd>
        </dl>
      </div>
    );

  const { rule, change } = traced;
  const statement = valueOf(rule.description);
  return (
    <div className={classes.rule} {...mark}>
      <RuleHead name={traced.name} change={change} />
      {statement !== null && (
        <blockquote className={classes.quote}>{statement}</blockquote>
      )}
      <Details traced={traced} rule={rule} element={element} />
      <Verification rule={rule} change={change} />
    </div>
  );
}

function RuleHead({
  name,
  change,
}: {
  name: string;
  change: TracedRule['change'];
}) {
  return (
    <div className={classes.ruleHead}>
      <Title
        order={3}
        size="h5"
        className={classes.ruleName}
        data-removed={change === 'removed' || undefined}
      >
        {name}
      </Title>
      <ChangeBadge change={change} />
    </div>
  );
}

const KIND_LABEL: Partial<Record<OutlineKind, string>> = {
  module: 'module',
  building_block: 'building block',
  behaviour: 'behaviour',
};

/** The element a rule is on, opened in the model view with it in hand. */
function ElementLink({ traced, changeId, docId }: RuleEntryProps) {
  const { element } = traced;
  return (
    <>
      <Link
        to="/changes/$changeId/design-docs/$docId"
        params={{ changeId, docId }}
        search={{ node: element.id }}
        className={classes.elementLink}
      >
        {element.name}
      </Link>
      <span className={classes.kind}>{KIND_LABEL[element.kind]}</span>
    </>
  );
}

/** A rule's category and type in one phrase, `Quality · Performance`. */
const classificationOf = (rule: DesignedRuleInput): string | null => {
  const words = [valueOf(rule.category), valueOf(rule.ruleType)].filter(
    (word) => word !== null,
  );
  return words.length > 0 ? words.join(' · ') : null;
};

/**
 * Where a rule lives and why it is there, collapsed: the line that opens it
 * still names its category and place, so a rule is placed without opening it.
 * A modified rule shows only the fields it changes.
 */
function Details({
  traced,
  rule,
  element,
}: {
  traced: TracedRule;
  rule: DesignedRuleInput;
  element: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const classification = classificationOf(rule);
  const rationale = valueOf(rule.rationale);
  const trace = traced.trace ?? [];
  const changed =
    traced.change === 'modified' &&
    (classification !== null || rationale !== null || traced.trace !== null);

  return (
    <div className={classes.details}>
      <UnstyledButton
        className={classes.toggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
      >
        <IconChevronRight
          size={14}
          className={classes.chevron}
          data-open={open || undefined}
          aria-hidden
        />
        <span className={classes.toggleLabel}>Details</span>
        <span className={classes.peek}>
          {[
            valueOf(rule.category),
            `${traced.module.name} › ${traced.element.name}`,
          ]
            .filter((word) => word !== null)
            .join(' · ')}
        </span>
        {changed && <span className={classes.changed}>changed</span>}
      </UnstyledButton>
      <dl id={id} hidden={!open} className={classes.fields}>
        {classification !== null && (
          <>
            <dt>Category</dt>
            <dd>{classification}</dd>
          </>
        )}
        <dt>Subsystem</dt>
        <dd>{traced.module.name}</dd>
        <dt>Element</dt>
        <dd>{element}</dd>
        {rationale !== null && (
          <>
            <dt>Rationale</dt>
            <dd>{rationale}</dd>
          </>
        )}
        {trace.length > 0 && (
          <>
            <dt>Trace</dt>
            <dd>{trace.join(', ')}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

/**
 * The rule's own scenarios, drawn as the model draws them and open on what
 * each says. An added rule without one says so — what nothing checks is a gap
 * a reviewer must see. A modified rule that leaves its scenarios alone keeps
 * the model's.
 */
function Verification({
  rule,
  change,
}: {
  rule: DesignedRuleInput;
  change: 'added' | 'modified';
}) {
  const scenarios = scenarioEntriesOf(rule.scenarios);
  if (scenarios.length === 0)
    return change === 'added' ? (
      <p className={classes.unverified}>
        <IconAlertCircle size={16} aria-hidden />
        No scenario verifies this rule
      </p>
    ) : (
      <Text className={classes.note}>Scenarios unchanged</Text>
    );
  return (
    <div className={classes.verification}>
      <ScenarioColumn scenarios={scenarios} defaultOpen headingOrder={4} />
    </div>
  );
}
