import { IconBolt } from '@tabler/icons-react';
import { Fragment } from 'react';
import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import type { OutlineNode } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { QualifiedName } from '#/shared/ui/qualified-name.tsx';
import type { DesignedBehaviorInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../../../design-doc-field.ts';
import { parameterItems, resultItems } from '../../change-list-items.ts';
import { useElementNavigation } from '../../element-navigation.ts';
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
      title="behaviors"
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
  const { has, select } = useElementNavigation();
  const removed = node.change === 'removed' || undefined;
  return has(node.path) ? (
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
  );
}

/** `(a, b) → C`: the inputs by name, the output by its type's last segment; each says what its type is on hover. */
function Shape({ behavior }: { behavior: DesignedBehaviorInput }) {
  const inputs = parameterItems(behavior.input).filter(
    ({ change }) => change !== 'removed',
  );
  const outputs = resultItems(behavior.output).filter(
    ({ change }) => change !== 'removed',
  );
  return (
    <>
      <span className={classes.punctuation}>(</span>
      {inputs.map(({ name, label, type, path }, index) => (
        <Fragment key={label}>
          {index > 0 && <span className={classes.punctuation}>, </span>}
          {/* By name, and on hover what its type is: `name: a.b.C`. */}
          <span className={classes.punctuation}>
            {name ?? label}:{' '}
            <OutputType label={type ?? name ?? 'unknown'} path={path} />
          </span>
        </Fragment>
      ))}
      <span className={classes.punctuation}>)</span>
      {outputs.length > 0 && (
        <>
          <span className={classes.punctuation}> → </span>
          {outputs.map(({ label, path }, index) => (
            <Fragment key={label}>
              {index > 0 && <span className={classes.punctuation}>, </span>}
              <OutputType label={label} path={path} />
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
function OutputType({ label, path }: { label: string; path: string | null }) {
  const { has, select } = useElementNavigation();
  return (
    <ElementTooltip name={label} hint>
      {path !== null && has(path) ? (
        <UnstyledButton
          className={classes.output}
          data-link
          onClick={() => select(path)}
        >
          <QualifiedName name={label} />
        </UnstyledButton>
      ) : (
        <span className={classes.output}>
          <QualifiedName name={label} />
        </span>
      )}
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
