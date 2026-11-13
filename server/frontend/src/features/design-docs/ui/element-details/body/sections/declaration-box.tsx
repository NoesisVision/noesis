import { QualifiedName } from '#/shared/ui/qualified-name.tsx';
import type { DesignDocFieldInput } from '../../../../design-doc-field.ts';
import {
  CardinalityMark,
  type MarkedCardinality,
} from '../../cardinality-mark.tsx';
import type { ChangeListItem } from '../../change-list-items.ts';
import { ElementLinkOrText } from '../../element-link-or-text.tsx';
import { ElementTooltip } from '../../element-tooltip.tsx';
import { WrittenBy } from '../../human-mark.tsx';
import classes from './declaration-box.module.css';

/**
 * One declaration — a property, an input, an output — as a box: its name, if
 * it has one, over its type as a tag, marked with how many it holds. An
 * output's name is always `result`, so its box holds the tag alone. The type
 * opens its row when the tree has one, and hovering it says what that type is.
 */
export function DeclarationBox({
  item,
  typePath,
  component: Component = 'div',
  output,
  nameWrittenOf,
}: {
  item: ChangeListItem;
  /** The row the type opens, if the tree has one. */
  typePath: string | null | undefined;
  /** `li` inside a list of them. */
  component?: 'div' | 'li';
  /** What a behavior gives back, drawn in the brand's tint. */
  output?: boolean;
  /** The fields of the whole declaration, for who wrote its name — which has no writer of its own. */
  nameWrittenOf?: readonly (DesignDocFieldInput<unknown> | undefined)[];
}) {
  const { change, label, name, type, cardinality } = item;
  const removed = change === 'removed' || undefined;
  const box = (
    <Component className={classes.box} data-output={output || undefined}>
      {name !== undefined && (
        <WrittenBy fields={nameWrittenOf ?? []}>
          <span className={classes.name} data-removed={removed}>
            {name}
          </span>
        </WrittenBy>
      )}
      {type !== undefined && (
        <DeclarationType
          type={type}
          cardinality={cardinality}
          path={typePath}
          tagged={name !== undefined || output === true}
        />
      )}
      {name === undefined && type === undefined && (
        <span className={classes.name} data-removed={removed}>
          {label}
        </span>
      )}
    </Component>
  );
  return box;
}

/** The type by its last segment, how many it holds after it; a link to its row when the tree has one. */
export function DeclarationType({
  type,
  cardinality,
  path,
  tagged,
}: {
  type: string;
  /** How many of it the slot holds, marked at the tag's start, when not exactly one. */
  cardinality?: MarkedCardinality | undefined;
  path: string | null | undefined;
  /** A tag, as under a name or as an output; otherwise it heads the box as text. */
  tagged: boolean;
}) {
  const marked = cardinality !== undefined;
  // Hovering the type says what it is: what it holds, or takes and gives.
  return (
    <ElementTooltip name={type} cardinality={cardinality}>
      <ElementLinkOrText
        path={path}
        className={tagged ? classes.type : classes.name}
        data-marked={marked || undefined}
      >
        {marked && <CardinalityMark cardinality={cardinality} />}
        <QualifiedName name={type} />
      </ElementLinkOrText>
    </ElementTooltip>
  );
}
