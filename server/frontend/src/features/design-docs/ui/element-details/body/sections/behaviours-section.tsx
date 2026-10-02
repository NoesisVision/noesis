import { IconBolt } from '@tabler/icons-react';
import { Fragment } from 'react';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import { QualifiedName } from '#/shared/ui/qualified-name.tsx';
import type { DesignedBehaviourInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../../../design-doc-field.ts';
import { parameterItems, resultItems } from '../../change-list-items.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import type { ElementRef } from '../../element-ref.ts';
import { ElementTooltip } from '../../element-tooltip.tsx';
import { DetailSection } from './detail-section.tsx';
import classes from './behaviours-section.module.css';
import canvas from './canvas.module.css';

interface BehavioursSectionProps {
  element: ElementRef;
  /**
   * Each behaviour as the tree has it, with what the document says about it —
   * none for one the document only removes, or never names.
   */
  behaviours: { node: OutlineNode; behaviour: DesignedBehaviourInput | null }[];
}

/**
 * A building block's behaviours, each read as a signature: what it is called,
 * what it takes and what it gives back, its kind, and what it is for. Its name
 * opens its row; what it takes in full is on that row's own page.
 */
export function BehavioursSection({ behaviours }: BehavioursSectionProps) {
  return (
    <DetailSection title="Behaviours" icon={<IconBolt />}>
      <ul className={canvas.canvas}>
        {behaviours.map(({ node, behaviour }) => (
          <li key={node.path} className={classes.behaviour}>
            <div className={classes.signature}>
              <Mark node={node} />
              {/* The name never breaks; what it takes and gives moves under
                  it, as one piece, when the line runs out. */}
              <code className={classes.code}>
                <BehaviourName node={node} />
                {behaviour !== null && (
                  <span className={classes.shape}>
                    <Shape behaviour={behaviour} />
                  </span>
                )}
              </code>
            </div>
            {behaviour !== null && <Description behaviour={behaviour} />}
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
        <KindIcon kind="behaviour" pattern={node.pattern} />
      </span>
      {node.patternLabel !== null && (
        <VisuallyHidden>{node.patternLabel}</VisuallyHidden>
      )}
    </>
  );
}

function BehaviourName({ node }: { node: OutlineNode }) {
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
function Shape({ behaviour }: { behaviour: DesignedBehaviourInput }) {
  const inputs = parameterItems(behaviour.input).filter(
    ({ change }) => change !== 'removed',
  );
  const outputs = resultItems(behaviour.output)
    .filter(({ change }) => change !== 'removed')
    .map(({ label }) => label);
  return (
    <>
      <span className={classes.punctuation}>(</span>
      {inputs.map(({ name, label }, index) => (
        <Fragment key={label}>
          {index > 0 && <span className={classes.punctuation}>, </span>}
          {/* By name, and on hover what its type is: `name: a.b.C`. */}
          <ElementTooltip name={label} shown={name ?? label} hint>
            <span className={classes.punctuation}>{name ?? label}</span>
          </ElementTooltip>
        </Fragment>
      ))}
      <span className={classes.punctuation}>)</span>
      {outputs.length > 0 && (
        <>
          <span className={classes.punctuation}> → </span>
          {outputs.map((output, index) => (
            <Fragment key={output}>
              {index > 0 && <span className={classes.punctuation}>, </span>}
              <ElementTooltip name={output} hint>
                <span className={classes.output}>
                  <QualifiedName name={output} />
                </span>
              </ElementTooltip>
            </Fragment>
          ))}
        </>
      )}
    </>
  );
}

function Description({ behaviour }: { behaviour: DesignedBehaviourInput }) {
  const description = valueOf(behaviour.description)?.trim();
  // As written: a markdown reader per behaviour is too heavy a list.
  return description ? (
    <p className={classes.description}>{description}</p>
  ) : null;
}

/** Shown only when the block has behaviours at all. */
BehavioursSection.shows = ({ behaviours }: BehavioursSectionProps) =>
  behaviours.length > 0;
