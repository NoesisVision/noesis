import type { ReactNode } from 'react';
import type { OutlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import { counted } from '#/features/design-docs/ui/plural.ts';
import { Stack } from '#/shared/design-system/stack.tsx';
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
import { DetailsPanel } from './details-panel.tsx';
import { ElementBody } from './element-body.tsx';
import { ElementFindings } from './element-findings.tsx';
import { ElementLinks } from './element-links.tsx';
import { hexagonId, type LaidOutNode } from './layout-architecture.ts';

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
  /** Clears the selection; without it — over a card, say — there is no close button. */
  onClear?: () => void;
  /** Read at a glance, over its card: smaller type, descriptions folded. */
  glance?: boolean;
  /** Shrinks the panel out of the way; without it there is no such button. */
  onMinimize?: () => void;
}

export function ArchitectureDetails(props: ArchitectureDetailsProps) {
  const { subject, onClear, glance, onMinimize, modelTree, onSelectElement } =
    props;
  const body = bodyOf(props);
  return (
    <DetailsPanel
      document={props.document}
      modelTree={modelTree}
      onSelectElement={onSelectElement}
      onClear={onClear}
      glance={glance}
      onMinimize={onMinimize}
      eyebrow={body.eyebrow}
      title={body.title}
      address={body.address}
    >
      {body.content}
      {subject.kind === 'element' && (
        <ElementBody
          id={subject.id}
          document={props.document}
          modelTree={modelTree}
        />
      )}
    </DetailsPanel>
  );
}

/** The name the details are read under, for what points at them. */
export function subjectTitleOf(props: ArchitectureDetailsProps): string {
  return bodyOf(props).title;
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
}: ArchitectureDetailsProps): Body {
  const links = (title: string, ids: string[], empty?: string) => (
    <ElementLinks title={title} ids={ids} modelTree={modelTree} empty={empty} />
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
        eyebrow:
          stakeholder === null || stakeholder.trim() === ''
            ? 'Need'
            : `Need · ${stakeholder}`,
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
            modelTree={modelTree}
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
    <Stack gap="sm">
      <DetailText>
        Read from building block types, visibility, the types each property,
        input and output is of, and the blocks each block says it uses.
      </DetailText>
      <DetailText>
        {`${counted(warnings, 'warning')} · ${counted(notes, 'note')} · ${count('pass')} passed.`}
      </DetailText>
      <DetailText>
        Not checked: calls between behaviours, within a hexagon or across them.
        The design document has no call edges.
      </DetailText>
    </Stack>
  );
}
