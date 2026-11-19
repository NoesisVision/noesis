import { IconArrowUpRight } from '@tabler/icons-react';
import { KindIcon } from '#/features/design-docs/element-reader.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import type { ModelSlots, WalkStep } from '../../system-model-exploration.ts';
import { SlotTree } from './slot-tree.tsx';
import { type Elements, kindOf, TypeWords } from './slot-words.tsx';
import classes from './slot-explorer.module.css';

/*
 * What a badge's type relates to: the type as a card names it, then a tree
 * of its state and its behaviors' inputs and outputs, each slot opening in
 * place onto what its own type relates to (`SlotTree`). A slot typed by a
 * primitive leads nowhere. A slot of a type already passed through is
 * marked so and still opens: the tree goes as deep as the reader takes it.
 * It only reads the model; nothing in it acts. Escape closes it (the
 * popover's own).
 */
export function SlotExplorer({
  root,
  slots,
  elements,
  onGoTo,
}: {
  /** The badge's own slot: its type is what the tree is of. */
  root: WalkStep;
  slots: ModelSlots;
  elements: Elements;
  /** Given when the badge's type has a card of its own: goes to it. */
  onGoTo?: () => void;
}) {
  const rootElement = elements.get(root.type);
  const goToLabel = `Go to ${root.typeName} on the diagram`;
  return (
    <div className={classes.explorer}>
      <div className={classes.head}>
        {/* The type, as a card names it: its kind's icon, its name, how
            many; then, when it has a card of its own, the way to it. */}
        <div className={classes.title}>
          {rootElement !== undefined && (
            <KindIcon
              kind={rootElement.kind}
              pattern={rootElement.pattern}
              size={16}
            />
          )}
          <span className={classes.titleType}>
            <TypeWords step={root} />
          </span>
          {onGoTo !== undefined && (
            <Tooltip label={goToLabel}>
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label={goToLabel}
                onClick={onGoTo}
              >
                <IconArrowUpRight size={14} stroke={2} aria-hidden />
              </ActionIcon>
            </Tooltip>
          )}
        </div>
        <Text component="span" fz="xs" c="dimmed">
          {kindOf(root.type, elements)}
        </Text>
      </div>
      <SlotTree root={root} slots={slots} elements={elements} />
    </div>
  );
}
