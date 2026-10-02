import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import type {
  OutlineKind,
  OutlineNode,
} from '#/shared/ui/model-tree/model-outline.ts';
import { TextSpoiler } from '#/shared/ui/text-spoiler.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../../../design-doc-field.ts';
import { ChangeBadge } from '../../change-badge.tsx';
import { findById } from '../../change-set.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import type { ElementRef } from '../../element-ref.ts';
import { ElementTooltip } from '../../element-tooltip.tsx';
import { DetailSection } from './detail-section.tsx';
import { BoxGrid } from './property-grid.tsx';
import classes from './element-cards-section.module.css';

/** How much of a description a card shows before "Show more". */
const DESCRIPTION_LENGTH = 80;

interface ElementCardsSectionProps {
  element: ElementRef;
  /** None for building blocks: their pattern captions already say what they are. */
  title?: string;
  /** The kind listed: a module's submodules, or its building blocks. */
  kind: Extract<OutlineKind, 'module' | 'building_block'>;
  /** Each as the tree has it, in the tree's order. */
  nodes: OutlineNode[];
  /** Where a card finds what the design says about its element. */
  doc: DesignDocumentInput;
}

/**
 * A module's submodules or building blocks as cards, drawn as properties are
 * drawn: each with the icon the tree gives it, its name — which opens its
 * row — what the design does to it, and the start of what the design says
 * about it. Cards of one pattern go together under it, the groups in the
 * order the tree reads them; elements with no pattern, modules among them,
 * are one grid with no caption.
 */
export function ElementCardsSection({
  title,
  kind,
  nodes,
  doc,
}: ElementCardsSectionProps) {
  return (
    <DetailSection title={title} icon={<KindIcon kind={kind} pattern={null} />}>
      <div className={classes.groups}>
        {groupsOf(nodes).map(({ label, nodes: grouped }) => (
          <PatternGroup
            key={label ?? ''}
            label={label}
            nodes={grouped}
            doc={doc}
          />
        ))}
      </div>
    </DetailSection>
  );
}

/** Nodes by their pattern label, each group where its first node stands. */
const groupsOf = (nodes: OutlineNode[]) => {
  const groups = new Map<string | null, OutlineNode[]>();
  for (const node of nodes) {
    const group = groups.get(node.patternLabel);
    if (group) group.push(node);
    else groups.set(node.patternLabel, [node]);
  }
  return [...groups].map(([label, grouped]) => ({ label, nodes: grouped }));
};

/** One pattern's cards under its caption, with how many there are; no caption when there is no pattern. */
function PatternGroup({
  label,
  nodes,
  doc,
}: {
  label: string | null;
  nodes: OutlineNode[];
  doc: DesignDocumentInput;
}) {
  const grid = (
    <BoxGrid
      cells={nodes.map((node) => ({
        key: node.path,
        content: (
          <ElementCard node={node} description={descriptionOf(doc, node)} />
        ),
      }))}
    />
  );
  if (label === null) return grid;
  return (
    <div className={classes.group}>
      <span className={classes.caption}>
        {/* The pattern's own icon, as its cards and the tree draw it. */}
        <span className={classes.icon} aria-hidden="true">
          <KindIcon kind={nodes[0]!.kind} pattern={nodes[0]!.pattern} />
        </span>
        {`${label} · ${nodes.length}`}
      </span>
      {grid}
    </div>
  );
}

function ElementCard({
  node,
  description,
}: {
  node: OutlineNode;
  description: string | null;
}) {
  const { has, select } = useElementNavigation();
  const removed = node.change === 'removed' || undefined;
  return (
    // By its address on hover, and what the design gives it.
    <ElementTooltip name={addressOf(node.path)}>
      <div className={classes.card}>
        <div className={classes.head}>
          <span className={classes.icon} aria-hidden="true">
            <KindIcon kind={node.kind} pattern={node.pattern} />
          </span>
          {has(node.path) ? (
            <UnstyledButton
              className={classes.name}
              data-link
              data-removed={removed}
              onClick={() => select(node.path)}
            >
              {node.name}
            </UnstyledButton>
          ) : (
            <span className={classes.name} data-removed={removed}>
              {node.name}
            </span>
          )}
          <ChangeBadge change={node.change} />
        </div>
        {description !== null && (
          <TextSpoiler
            text={description}
            maxLength={DESCRIPTION_LENGTH}
            className={classes.description}
          />
        )}
      </div>
    </ElementTooltip>
  );
}

/** `building_block|a.b.C` is at `a.b.C`. */
const addressOf = (path: string) => path.slice(path.indexOf('|') + 1);

/**
 * The first paragraph of what the design says about an element, as text: a
 * diagram's fence or a heading is no way to start a card. None for an
 * element the document does not describe.
 */
const descriptionOf = (
  doc: DesignDocumentInput,
  node: OutlineNode,
): string | null => {
  if (node.elementId === null) return null;
  const element =
    node.kind === 'module'
      ? findById(doc.modules, node.elementId)
      : findById(doc.buildingBlocks, node.elementId);
  const text = valueOf(element?.description) ?? '';
  const paragraph = text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find((part) => part !== '' && !part.startsWith('```'));
  return paragraph === undefined
    ? null
    : paragraph.replace(/^#+\s*/, '').replace(/\s+/g, ' ');
};

/** Shown only when there is something under the element to list. */
ElementCardsSection.shows = ({ nodes }: ElementCardsSectionProps) =>
  nodes.length > 0;
