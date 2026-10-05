import type { ReactNode } from 'react';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { QualifiedName } from '#/shared/ui/qualified-name.tsx';
import { TextSpoiler } from '#/shared/ui/text-spoiler.tsx';
import type { ChangeListItem } from '../../change-list-items.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import { ElementTooltip } from '../../element-tooltip.tsx';
import classes from './declaration-box.module.css';

/** How much of a description shows before "Show more". */
const DESCRIPTION_LENGTH = 80;

/**
 * One declaration — a property, an input, an output — as a box: its name, if
 * it has one, over its type read short, and what the design says it is,
 * folded past 80 characters. The type opens its row when the tree has one;
 * hovering anywhere on the box says what that type is.
 */
export function DeclarationBox({
  item,
  typePath,
  component: Component = 'div',
  output,
  actions,
}: {
  item: ChangeListItem;
  /** The row the type opens, if the tree has one. */
  typePath: string | null | undefined;
  /** `li` inside a list of them. */
  component?: 'div' | 'li';
  /** What a behaviour gives back, drawn in the brand's tint. */
  output?: boolean;
  /** What may be done to the declaration, in the box's corner. */
  actions?: ReactNode;
}) {
  const { change, label, name, type, description } = item;
  const removed = change === 'removed' || undefined;
  const box = (
    <Component className={classes.box} data-output={output || undefined}>
      {actions && <span className={classes.actions}>{actions}</span>}
      {name !== undefined && (
        <span className={classes.name} data-removed={removed}>
          {name}
        </span>
      )}
      {type !== undefined && (
        <Type type={type} path={typePath} named={name !== undefined} />
      )}
      {name === undefined && type === undefined && (
        <span className={classes.name} data-removed={removed}>
          {label}
        </span>
      )}
      {description !== undefined && (
        <TextSpoiler
          text={description}
          maxLength={DESCRIPTION_LENGTH}
          className={classes.description}
        />
      )}
    </Component>
  );
  return type === undefined ? (
    box
  ) : (
    <ElementTooltip name={type}>{box}</ElementTooltip>
  );
}

/** The type by its last segment; a link to its row when the tree has one. */
function Type({
  type,
  path,
  named,
}: {
  type: string;
  path: string | null | undefined;
  /** Under a name it is the second line; alone it heads the box. */
  named: boolean;
}) {
  const { has, select } = useElementNavigation();
  const className = named ? classes.type : classes.name;
  return path != null && has(path) ? (
    <UnstyledButton
      className={className}
      data-link
      onClick={() => select(path)}
    >
      <QualifiedName name={type} />
    </UnstyledButton>
  ) : (
    <span className={className}>
      <QualifiedName name={type} />
    </span>
  );
}
