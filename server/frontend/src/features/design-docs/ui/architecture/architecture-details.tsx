import { IconX } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { OutlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import { counted } from '#/features/design-docs/ui/plural.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import {
  type ArchitectureCheck,
  type ArchitectureOutline,
  CHECK_LEVEL_META,
  UNDRAWN_NAME,
} from '../../architecture-outline.ts';
import { CHECKS_PATH } from '../../architecture-tree.ts';
import { valueOf } from '../../design-doc-field.ts';
import { needNameOf } from '../../design-doc-requirements.ts';
import { kindOf, nameOf } from '../../element-id.ts';
import { KINDS } from './architecture-kinds.ts';
import type { ArchitectureSubject } from './architecture-selection.ts';
import { DetailText } from './detail-parts.tsx';
import { ElementBody } from './element-body.tsx';
import { ElementFindings } from './element-findings.tsx';
import { ElementLinks } from './element-links.tsx';
import { hexagonId, type LaidOutNode } from './layout-architecture.ts';
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
    <Stack gap="md" p="md">
      <Group component="header" align="flex-start" gap="xs" wrap="nowrap">
        <Stack gap={2} flex={1} miw={0}>
          <Text
            component="span"
            fz={11}
            fw={600}
            lts="0.06em"
            tt="uppercase"
            c="var(--noesis-secondary-text)"
          >
            {body.eyebrow}
          </Text>
          <Title order={2} size="h4" className={classes.wraps}>
            {body.title}
          </Title>
          {body.address !== undefined && (
            <Text
              component="span"
              ff="monospace"
              fz="xs"
              c="var(--noesis-secondary-text)"
              className={classes.wraps}
            >
              {body.address}
            </Text>
          )}
        </Stack>
        <ActionIcon
          variant="subtle"
          aria-label="Clear the selection"
          title="Clear the selection"
          onClick={onClear}
        >
          <IconX size={18} stroke={1.6} aria-hidden />
        </ActionIcon>
      </Group>
      {body.content}
      {subject.kind === 'element' && (
        <ElementBody
          id={subject.id}
          document={props.document}
          modelTree={props.modelTree}
          onSelectElement={props.onSelectElement}
        />
      )}
    </Stack>
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
              <DetailText>
                Each need, and the driving ports whose rules answer it.
              </DetailText>
            ),
          };
    case 'check': {
      const { check } = subject;
      return {
        eyebrow: `Check · ${CHECK_LEVEL_META[check.level].label}`,
        title: check.title,
        content: (
          <>
            <DetailText>{check.text}</DetailText>
            {links(CHECK_LEVEL_META[check.level].elements, check.elementIds)}
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
            <DetailText>{valueOf(need.statement) ?? ''}</DetailText>
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
      // A module's card is its hexagon, which goes by an id of its own.
      const drawn = card ?? cards.get(hexagonId(subject.id));
      return {
        eyebrow:
          (drawn && KINDS[drawn.kind].name) ?? UNDRAWN_NAME[kindOf(subject.id)],
        title: drawn?.label ?? node?.name ?? nameOf(subject.id),
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
  const { about, word } = KINDS[card.kind];
  return {
    eyebrow: about?.eyebrow ?? word,
    title: about?.title?.(portName) ?? card.label,
    content: (
      <>
        {about !== undefined && <DetailText>{about.text(portName)}</DetailText>}
        {about?.port !== undefined && links(about.port, [port])}
      </>
    ),
  };
}

/** What the checks found, counted, and what they cannot see. */
function ChecksSummary({ checks }: { checks: ArchitectureCheck[] }) {
  const count = (level: ArchitectureCheck['level']) =>
    checks.filter((check) => check.level === level).length;
  const warnings = count('warning');
  const notes = count('note');
  return (
    <>
      <DetailText>
        Read from building block types, visibility and the types each property,
        input and output uses.
      </DetailText>
      <DetailText>
        {`${counted(warnings, 'warning')} · ${counted(notes, 'note')} · ${count('pass')} passed.`}
      </DetailText>
      <DetailText>
        Not checked: which service uses which driven port, and calls between
        hexagons. The design document has no call edges.
      </DetailText>
    </>
  );
}
