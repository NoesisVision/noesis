import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { QualifiedName } from '#/shared/ui/qualified-name.tsx';
import type { DesignDocFieldInput } from '../../../../design-doc-field.ts';
import type { ChangeListItem } from '../../change-list-items.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import { ElementTooltip } from '../../element-tooltip.tsx';
import { WrittenBy } from '../../human-mark.tsx';
import classes from './declaration-box.module.css';

/**
 * One declaration — a property, an input, an output — as a box: its name, if
 * it has one, over its type read short and how many it holds. The type opens
 * its row when the tree has one, and hovering it says what that type is.
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
          suffix={cardinality}
          path={typePath}
          named={name !== undefined}
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
  suffix = '',
  path,
  named,
}: {
  type: string;
  /** What follows the type: how many of it the slot holds, when not exactly one. */
  suffix?: string | undefined;
  path: string | null | undefined;
  /** Under a name it is the second line; alone it heads the box. */
  named: boolean;
}) {
  const { has, select } = useElementNavigation();
  const className = named ? classes.type : classes.name;
  // Hovering the type says what it is: what it holds, or takes and gives.
  return (
    <ElementTooltip name={type}>
      {path != null && has(path) ? (
        <UnstyledButton
          className={className}
          data-link
          onClick={() => select(path)}
        >
          <QualifiedName name={type} />
          {suffix}
        </UnstyledButton>
      ) : (
        <span className={className}>
          <QualifiedName name={type} />
          {suffix}
        </span>
      )}
    </ElementTooltip>
  );
}
