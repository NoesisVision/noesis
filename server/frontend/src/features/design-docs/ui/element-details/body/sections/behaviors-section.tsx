import { IconBolt } from '@tabler/icons-react';
import { Fragment, type ReactNode } from 'react';
import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import type { OutlineNode } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { QualifiedName } from '#/shared/ui/qualified-name.tsx';
import type { DesignedBehaviorInput } from '#backend/app/design-docs/design-doc.ts';
import type { PartOwner } from '../../../../design-doc-edit.ts';
import { valueOf } from '../../../../design-doc-field.ts';
import {
  CardinalityMark,
  type MarkedCardinality,
} from '../../cardinality-mark.tsx';
import {
  type ChangeListItem,
  parameterItems,
  resultItems,
} from '../../change-list-items.ts';
import { useDesignDocument } from '../../design-document-context.ts';
import { ElementLinkOrText } from '../../element-link-or-text.tsx';
import type { ElementRef } from '../../element-ref.ts';
import { ElementTooltip } from '../../element-tooltip.tsx';
import { MarkdownReading } from '../../markdown-reading.tsx';
import { DetailSection } from './detail-section.tsx';
import { WritableDeclarationName } from './writable-declaration-box.tsx';
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
                    <BehaviorShape behavior={behavior} />
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

/** A behavior's shape, from what the document says it takes and gives. */
function BehaviorShape({ behavior }: { behavior: DesignedBehaviorInput }) {
  const doc = useDesignDocument();
  return (
    <Shape
      inputs={doc === null ? [] : parameterItems(doc, behavior.id)}
      outputs={doc === null ? [] : resultItems(doc, behavior.id)}
    />
  );
}

/**
 * What a behavior takes and gives on a card of its own, as its block's
 * Behaviors list writes it beside its name: for the behavior's own page,
 * whose name and definition are its heading already. Read wherever the
 * behavior is — the model as it stands, a design, a card on a canvas —
 * and, in a design, what it removes is struck rather than left out, and an
 * input it adds is named in place.
 */
export function SignatureCard({
  inputs,
  outputs,
  owner = null,
}: {
  inputs: readonly ChangeListItem[];
  outputs: readonly ChangeListItem[];
  /** The behavior, where its inputs may be written; none where they are only read. */
  owner?: PartOwner | null;
}) {
  return (
    <div className={`${classes.behavior} ${classes.alone}`}>
      <code className={classes.code}>
        <span className={classes.shape}>
          <Shape inputs={inputs} outputs={outputs} owner={owner} struck />
        </span>
      </code>
    </div>
  );
}

/**
 * `(a: A, b: B) → C`: the inputs by name and type, the output by its type's
 * last segment; each type says what it is on hover. What the design removes
 * is left out of a block's list, and struck on the behavior's own page.
 */
function Shape({
  inputs: allInputs,
  outputs: allOutputs,
  owner = null,
  struck = false,
}: {
  inputs: readonly ChangeListItem[];
  outputs: readonly ChangeListItem[];
  owner?: PartOwner | null;
  /** Keeps what the design removes in the signature, struck. */
  struck?: boolean;
}) {
  const kept = ({ change }: { change: string }) =>
    struck || change !== 'removed';
  const inputs = allInputs.filter(kept);
  const outputs = allOutputs.filter(kept);
  const removed = (change: string) => change === 'removed' || undefined;
  return (
    <>
      <span className={classes.punctuation}>(</span>
      {inputs.map((item, index) => (
        <Fragment key={`${item.change}:${item.label}`}>
          {index > 0 && <span className={classes.punctuation}>, </span>}
          {/* By name, and on hover what its type is: `name: a.b.C`. */}
          <span
            className={classes.punctuation}
            data-removed={removed(item.change)}
          >
            <WritableDeclarationName
              item={item}
              kind="parameter"
              owner={owner}
              className={classes.inputName}
            />
            {': '}
            <OutputType
              label={item.type ?? item.name ?? 'unknown'}
              cardinality={item.cardinality}
              path={item.path}
            />
          </span>
        </Fragment>
      ))}
      <span className={classes.punctuation}>)</span>
      {outputs.length > 0 && (
        <>
          <span className={classes.punctuation}> → </span>
          {outputs.map(({ change, label, type, cardinality, path }, index) => (
            <Fragment key={`${change}:${label}`}>
              {index > 0 && <span className={classes.punctuation}>, </span>}
              <Struck removed={change === 'removed'}>
                <OutputType
                  label={type ?? label}
                  cardinality={cardinality}
                  path={path}
                />
              </Struck>
            </Fragment>
          ))}
        </>
      )}
    </>
  );
}

/** What the design removes, struck; anything else as it is, with nothing round it. */
function Struck({
  removed,
  children,
}: {
  removed: boolean;
  children: ReactNode;
}) {
  return removed ? <span data-removed>{children}</span> : children;
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
