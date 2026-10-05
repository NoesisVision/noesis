import { IconX } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type { OutlineTree } from '#/shared/ui/model-tree/outline-tree.ts';
import { counted } from '#/shared/ui/plural.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  type ArchitectureCheck,
  type ArchitectureOutline,
  LEVEL_LABEL,
} from '../../architecture-outline.ts';
import { CHECKS_PATH } from '../../architecture-tree.ts';
import { valueOf } from '../../design-doc-field.ts';
import { needNameOf } from '../../design-doc-requirements.ts';
import { nameOf } from '../../element-id.ts';
import { KINDS } from './architecture-kinds.ts';
import type { ArchitectureSubject } from './architecture-selection.ts';
import { ElementBody } from './element-body.tsx';
import { ElementFindings } from './element-findings.tsx';
import { ElementLinks } from './element-links.tsx';
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
  const { subject, onClear } = props;
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
        <ElementBody
          id={subject.id}
          document={props.document}
          modelTree={props.modelTree}
          onSelectElement={props.onSelectElement}
        />
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
        eyebrow: `Check · ${LEVEL_LABEL[check.level]}`,
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
        title: needNameOf(need),
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
        eyebrow: KINDS[card?.kind ?? 'element'].name ?? 'Element',
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
        {`${counted(warnings, 'warning')} · ${counted(notes, 'note')} · ${count('pass')} passed.`}
      </Text>
      <Text className={classes.text}>
        Not checked: which service uses which driven port, and calls between
        hexagons. The design document has no call edges.
      </Text>
    </>
  );
}
