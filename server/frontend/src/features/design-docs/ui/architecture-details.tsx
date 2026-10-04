import { IconX } from '@tabler/icons-react';
import { type ReactNode, useMemo } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import type {
  ArchitectureCheck,
  ArchitectureOutline,
} from '../architecture-outline.ts';
import { nameOf } from '../architecture-outline.ts';
import { CHECKS_PATH } from '../architecture-tree.ts';
import { inferredFlowOf } from '../design-doc-architecture.ts';
import { valueOf } from '../design-doc-field.ts';
import type { ArchitectureSubject } from './architecture-selection.ts';
import { bodySections } from './element-details/body/body-sections.tsx';
import { DesignDocumentContext } from './element-details/design-document-context.ts';
import { ElementNavigationContext } from './element-details/element-navigation.ts';
import type { LaidOutNode } from './layout-architecture.ts';
import classes from './architecture-details.module.css';

/*
 * What the selection says, under the rows that chose it. An element reads as
 * the model reads it, after what the architecture finds about it; a check, a
 * need or a placeholder the design does not hold gets a short body of its
 * own, linking to the elements it is about.
 *
 * The page heading is the document's; the subject here is an `h2`, its parts
 * `h3`s.
 */

export interface ArchitectureDetailsProps {
  subject: ArchitectureSubject;
  outline: ArchitectureOutline;
  document: DesignDocumentInput;
  /** The model's own tree, which an element's body sections read through. */
  modelTree: OutlineTree;
  /** Every card the diagram draws, by id. */
  cards: ReadonlyMap<string, LaidOutNode>;
  onSelectElement: (id: string) => void;
  onClear: () => void;
}

export function ArchitectureDetails(props: ArchitectureDetailsProps) {
  const { subject, outline, onClear } = props;
  const body = bodyOf(props);
  return (
    <div className={classes.details}>
      <header className={classes.head}>
        <div className={classes.heading}>
          <span className={classes.eyebrow}>{body.eyebrow}</span>
          <Title order={2} size="h4" className={classes.title}>
            {body.title}
          </Title>
          {body.address !== undefined && (
            <span className={classes.address}>{body.address}</span>
          )}
        </div>
        <ActionIcon
          variant="subtle"
          aria-label="Clear the selection"
          title="Clear the selection"
          onClick={onClear}
        >
          <IconX size={18} stroke={1.6} aria-hidden />
        </ActionIcon>
      </header>
      {body.content}
      {subject.kind === 'element' && (
        <ElementBody {...props} id={subject.id} outline={outline} />
      )}
    </div>
  );
}

interface Body {
  eyebrow: string;
  title: string;
  address?: string;
  content: ReactNode;
}

function bodyOf({
  subject,
  outline,
  cards,
  document: doc,
  modelTree,
  onSelectElement,
}: ArchitectureDetailsProps): Body {
  const links = (title: string, ids: string[], empty?: string) => (
    <ElementLinks
      title={title}
      ids={ids}
      cards={cards}
      empty={empty}
      onSelect={onSelectElement}
    />
  );
  switch (subject.kind) {
    case 'group':
      return subject.path === CHECKS_PATH
        ? {
            eyebrow: 'Group',
            title: 'Checks',
            content: <ChecksSummary checks={outline.checks} />,
          }
        : {
            eyebrow: 'Group',
            title: 'Needs at the ports',
            content: (
              <Text className={classes.text}>
                Each need, and the driving ports whose rules answer it.
              </Text>
            ),
          };
    case 'check': {
      const { check } = subject;
      return {
        eyebrow: `Check · ${LEVEL_WORD[check.level]}`,
        title: check.title,
        content: (
          <>
            <Text className={classes.text}>{check.text}</Text>
            {links(
              check.level === 'pass' ? 'Checked' : 'Concerns',
              check.elementIds,
            )}
          </>
        ),
      };
    }
    case 'need': {
      const { need, ports } = subject.need;
      const stakeholder = valueOf(need.stakeholder);
      return {
        eyebrow: stakeholder === null ? 'Need' : `Need · ${stakeholder}`,
        title: valueOf(need.name) ?? need.id,
        address: `need|${need.id}`,
        content: (
          <>
            <Text className={classes.text}>
              {valueOf(need.statement) ?? ''}
            </Text>
            {links(
              'Answered at',
              ports,
              'No port answers it: no rule of a driving port traces to it.',
            )}
          </>
        ),
      };
    }
    case 'element': {
      const card = cards.get(subject.id);
      const node = modelTree.byPath.get(subject.id);
      if (card !== undefined && card.element === null)
        return placeholderBody(card, cards, links);
      return {
        eyebrow: KIND_WORD[card?.kind ?? 'element'] ?? 'Element',
        title: card?.label ?? node?.name ?? nameOf(subject.id),
        address: subject.id,
        content: (
          <ElementFindings
            id={subject.id}
            outline={outline}
            document={doc}
            cards={cards}
            onSelect={onSelectElement}
          />
        ),
      };
    }
  }
}

const LEVEL_WORD: Record<ArchitectureCheck['level'], string> = {
  warning: 'Warning',
  note: 'Note',
  pass: 'Pass',
};

const KIND_WORD: Partial<Record<LaidOutNode['kind'], string>> = {
  hexagon: 'Module · hexagon',
  drivingPort: 'Driving port',
  service: 'Application service',
  element: 'Domain core',
  drivenPort: 'Driven port',
};

function placeholderBody(
  card: LaidOutNode,
  cards: ReadonlyMap<string, LaidOutNode>,
  links: (title: string, ids: string[]) => ReactNode,
): Body {
  const port = card.id.slice(card.id.indexOf(':') + 1);
  const portName = cards.get(port)?.label ?? nameOf(port);
  switch (card.kind) {
    case 'adapterIn':
      return {
        eyebrow: 'In adapter · not designed',
        title: `In adapter for ${portName}`,
        content: (
          <>
            <Text className={classes.text}>
              {`Turns a request into a call of the driving port ${portName}: a REST endpoint, a UI, a message listener. The design document holds no adapters.`}
            </Text>
            {links('Adapts', [port])}
          </>
        ),
      };
    case 'adapterOut':
      return {
        eyebrow: 'Out adapter · not designed',
        title: `Out adapter for ${portName}`,
        content: (
          <>
            <Text className={classes.text}>
              {`Implements the driven port ${portName} with a technology: a database, a message broker, an HTTP client. The design document holds no adapters.`}
            </Text>
            {links('Implements', [port])}
          </>
        ),
      };
    case 'caller':
      return {
        eyebrow: 'Caller · unknown',
        title: card.label,
        content: (
          <>
            <Text className={classes.text}>
              {`${portName} is public and names no actor, so another subsystem calls it. Which one is not in the design document.`}
            </Text>
            {links('Calls', [port])}
          </>
        ),
      };
    default:
      return {
        eyebrow: 'Actor',
        title: card.label,
        content: (
          <Text className={classes.text}>
            Named on a public behaviour as the actor that calls it, through an
            in adapter.
          </Text>
        ),
      };
  }
}

/** What the checks found, counted, and what they cannot see. */
function ChecksSummary({ checks }: { checks: ArchitectureCheck[] }) {
  const count = (level: ArchitectureCheck['level']) =>
    checks.filter((check) => check.level === level).length;
  const warnings = count('warning');
  const notes = count('note');
  return (
    <>
      <Text className={classes.text}>
        Read from building block types, visibility and the types each property,
        input and output uses.
      </Text>
      <Text className={classes.text}>
        {`${warnings} ${warnings === 1 ? 'warning' : 'warnings'} · ${notes} ${notes === 1 ? 'note' : 'notes'} · ${count('pass')} passed.`}
      </Text>
      <Text className={classes.text}>
        Not checked: which service uses which driven port, and calls between
        hexagons. The design document has no call edges.
      </Text>
    </>
  );
}

function ElementLinks({
  title,
  ids,
  cards,
  empty,
  onSelect,
}: {
  title: string;
  ids: string[];
  cards: ReadonlyMap<string, LaidOutNode>;
  empty?: string | undefined;
  onSelect: (id: string) => void;
}) {
  if (ids.length === 0 && empty === undefined) return null;
  return (
    <section className={classes.section}>
      <Title order={3} className={classes.sectionTitle}>
        {title}
      </Title>
      {ids.length === 0 ? (
        <Text className={classes.text}>{empty}</Text>
      ) : (
        <ul className={classes.chips}>
          {ids.map((id) => (
            <li key={id}>
              <UnstyledButton
                className={classes.chip}
                onClick={() => onSelect(id)}
              >
                {cards.get(id)?.label ?? nameOf(id)}
              </UnstyledButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** What the architecture finds about one element: its checks, its types, the flow its types suggest. */
function ElementFindings({
  id,
  outline,
  document: doc,
  cards,
  onSelect,
}: {
  id: string;
  outline: ArchitectureOutline;
  document: DesignDocumentInput;
  cards: ReadonlyMap<string, LaidOutNode>;
  onSelect: (id: string) => void;
}) {
  const checks = outline.checks.filter(
    (check) => check.level !== 'pass' && check.elementIds.includes(id),
  );
  const uses = cards.get(id)?.element?.uses ?? [];
  const flows = useMemo(
    () => inferredFlowOf(doc, outline, id),
    [doc, outline, id],
  );
  return (
    <>
      {checks.length > 0 && (
        <section className={classes.section}>
          <Title order={3} className={classes.sectionTitle}>
            Checks
          </Title>
          <ul className={classes.findings}>
            {checks.map((check) => (
              <li key={check.id}>
                <span className={classes.pill} data-level={check.level}>
                  {LEVEL_WORD[check.level]}
                </span>
                <span>{check.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ElementLinks
        title="Speaks in"
        ids={uses}
        cards={cards}
        onSelect={onSelect}
      />
      {flows.length > 0 && (
        <section className={classes.section}>
          <Title order={3} className={classes.sectionTitle}>
            Flow inferred from types
          </Title>
          <ul className={classes.findings}>
            {flows.map((flow) => (
              <li key={`${flow.direction}:${flow.type}:${flow.other.id}`}>
                <span className={classes.direction}>
                  {flow.direction === 'gives' ? 'gives' : 'takes'}
                </span>
                <span>
                  <code>{nameOf(flow.type)}</code>
                  {flow.direction === 'gives' ? ' to ' : ' from '}
                  {`${flow.other.owner}.${flow.other.name}`}
                  {flow.typeMatchOnly && (
                    <span className={classes.note}> · type match only</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** The element as the model reads it, below what the architecture finds. */
function ElementBody({
  id,
  document: doc,
  modelTree,
  onSelectElement,
}: ArchitectureDetailsProps & { id: string }) {
  const navigation = useMemo(
    () => ({
      has: (path: string) => modelTree.byPath.has(path),
      select: onSelectElement,
    }),
    [modelTree, onSelectElement],
  );
  const node = modelTree.byPath.get(id);
  if (node === undefined) return null;
  return (
    <DesignDocumentContext.Provider value={doc}>
      <ElementNavigationContext.Provider value={navigation}>
        <div className={classes.sections}>
          {bodySections(node, doc, modelTree)}
        </div>
      </ElementNavigationContext.Provider>
    </DesignDocumentContext.Provider>
  );
}
