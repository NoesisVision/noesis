import { IconBolt } from '@tabler/icons-react';
import { Fragment } from 'react';
import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import type { OutlineNode } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { QualifiedName } from '#/shared/ui/qualified-name.tsx';
import type { DesignedBehaviorInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../../../design-doc-field.ts';
import {
  CardinalityMark,
  type MarkedCardinality,
} from '../../cardinality-mark.tsx';
import { parameterItems, resultItems } from '../../change-list-items.ts';
import { useDesignDocument } from '../../design-document-context.ts';
import { ElementLinkOrText } from '../../element-link-or-text.tsx';
import type { ElementRef } from '../../element-ref.ts';
import { ElementTooltip } from '../../element-tooltip.tsx';
import { MarkdownReading } from '../../markdown-reading.tsx';
import { DetailSection } from './detail-section.tsx';
import classes from './behaviors-section.module.css';

interface BehaviorsSectionProps {
  element: ElementRef;
  /**
   * Each behavior as the tree has it, with what the document says about it —
   * none for one the document only removes, or never names.
   */
  behaviors: { node: OutlineNode; behavior: DesignedBehaviorInput | null }[];
}

/**
 * A building block's behaviors, each read as a signature: what it is called,
 * what it takes and what it gives back, its kind, and what it is for. Its name
 * opens its row; what it takes in full is on that row's own page.
 */
export function BehaviorsSection({ behaviors }: BehaviorsSectionProps) {
  return (
    <DetailSection
      title="Behaviors"
      icon={<IconBolt />}
      count={behaviors.length}
    >
      <ul className={classes.list}>
        {behaviors.map(({ node, behavior }) => (
          <li key={node.path} className={classes.behavior}>
            <div className={classes.signature}>
              <Mark node={node} />
              {/* The name never breaks; what it takes and gives moves under
                  it, as one piece, when the line runs out. */}
              <code className={classes.code}>
                <BehaviorName node={node} />
                {behavior !== null && (
                  <span className={classes.shape}>
                    <Shape behavior={behavior} />
                  </span>
                )}
              </code>
            </div>
            {behavior !== null && <Definition behavior={behavior} />}
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}

/**
 * The kind's icon as the tree draws it — a command, a query and an event each
 * in its own colour. It is the only place the kind is shown, so a screen
 * reader hears the kind in words in its place.
 */
function Mark({ node }: { node: OutlineNode }) {
  return (
    <>
      <span className={classes.mark} aria-hidden="true">
        <KindIcon kind="behavior" pattern={node.pattern} />
      </span>
      {node.patternLabel !== null && (
        <VisuallyHidden>{node.patternLabel}</VisuallyHidden>
      )}
    </>
  );
}

function BehaviorName({ node }: { node: OutlineNode }) {
  return (
    <ElementLinkOrText
      path={node.path}
      className={classes.name}
      removed={node.change === 'removed'}
    >
      {node.name}
    </ElementLinkOrText>
  );
}

/** `(a, b) → C`: the inputs by name, the output by its type's last segment; each says what its type is on hover. */
function Shape({ behavior }: { behavior: DesignedBehaviorInput }) {
  const doc = useDesignDocument();
  const kept = ({ change }: { change: string }) => change !== 'removed';
  const inputs =
    doc === null ? [] : parameterItems(doc, behavior.id).filter(kept);
  const outputs =
    doc === null ? [] : resultItems(doc, behavior.id).filter(kept);
  return (
    <>
      <span className={classes.punctuation}>(</span>
      {inputs.map(({ name, label, type, cardinality, path }, index) => (
        <Fragment key={label}>
          {index > 0 && <span className={classes.punctuation}>, </span>}
          {/* By name, and on hover what its type is: `name: a.b.C`. */}
          <span className={classes.punctuation}>
            {name ?? label}:{' '}
            <OutputType
              label={type ?? name ?? 'unknown'}
              cardinality={cardinality}
              path={path}
            />
          </span>
        </Fragment>
      ))}
      <span className={classes.punctuation}>)</span>
      {outputs.length > 0 && (
        <>
          <span className={classes.punctuation}> → </span>
          {outputs.map(({ label, type, cardinality, path }, index) => (
            <Fragment key={label}>
              {index > 0 && <span className={classes.punctuation}>, </span>}
              <OutputType
                label={type ?? label}
                cardinality={cardinality}
                path={path}
              />
            </Fragment>
          ))}
        </>
      )}
    </>
  );
}

/**
 * What a behavior gives back, by its type's last segment: a link to that
 * type's row when the tree has one — a building block, not a primitive.
 */
function OutputType({
  label,
  cardinality,
  path,
}: {
  label: string;
  /** How many of the type it holds, marked after the type, when not exactly one. */
  cardinality?: MarkedCardinality | undefined;
  path: string | null;
}) {
  return (
    <ElementTooltip name={label} hint cardinality={cardinality}>
      <ElementLinkOrText path={path} className={classes.output}>
        <QualifiedName name={label} />
        {cardinality !== undefined && (
          <CardinalityMark cardinality={cardinality} />
        )}
      </ElementLinkOrText>
    </ElementTooltip>
  );
}

function Definition({ behavior }: { behavior: DesignedBehaviorInput }) {
  const definition = valueOf(behavior.definition)?.trim();
  return definition ? (
    <div className={classes.definition}>
      <MarkdownReading markdown={definition} />
    </div>
  ) : null;
}

/** Shown only when the block has behaviors at all. */
BehaviorsSection.shows = ({ behaviors }: BehaviorsSectionProps) =>
  behaviors.length > 0;
