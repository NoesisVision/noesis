import { IconSearch, IconX } from '@tabler/icons-react';
import {
  type KeyboardEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  TreeInactive,
  TreeToggling,
} from '#/features/design-docs/ui/model-tree/model-tree.tsx';
import {
  type SelectSource,
  useModelTree,
} from '#/features/design-docs/ui/model-tree/use-model-tree.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { TextInput } from '#/shared/design-system/text-input.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { outlineOf } from '../design-doc-outline.ts';
import { Outline } from './outline.tsx';
import classes from './element-search.module.css';

/** The rows that stand for an element of a view; a group only opens and shuts. */
const SHOWABLE = new Set(['module', 'building_block', 'behavior']);

/**
 * A model's tree, its modules down to their building blocks and behaviors,
 * narrowed by what is typed in the box above it: names and patterns, each
 * match with the line of modules down to it. Arrow Down from the box steps
 * into the tree; the box is what takes the focus when a dialog round it
 * opens. For a model read as it stands, so nothing in it is a change.
 *
 * Read one of two ways. Ticking: each element's row starts with a tick box
 * saying whether the view draws it; a click on the box, or Enter or Space on
 * the row, puts it in or takes it out, and a click elsewhere on a row does
 * nothing. Picking: no boxes, and a click on an element's row, or Enter on
 * it, picks that element; a group's row only opens and shuts.
 */
export type ElementSearchProps = {
  document: DesignDocumentInput;
} & (
  | {
      /** Whether the view draws an element now. */
      isShown: (id: string) => boolean;
      /** Adds the element to the view, or removes it. */
      onShow: (id: string, shown: boolean) => void;
      onPick?: never;
      isDrawn?: never;
    }
  | {
      /** The element a row stands for, clicked. */
      onPick: (id: string) => void;
      /**
       * Whether the view draws an element already: one that is, is left
       * out, unless something under it is not — then it shows greyed, to
       * be opened, not picked.
       */
      isDrawn?: (id: string) => boolean;
      isShown?: never;
      onShow?: never;
    }
);

export function ElementSearch({
  document,
  isShown,
  onShow,
  onPick,
  isDrawn,
}: ElementSearchProps) {
  const nodes = useMemo(() => {
    const all = outlineOf(document).map((node) => ({
      ...node,
      change: 'unchanged' as const,
    }));
    if (isDrawn === undefined) return all;
    // What is drawn is left out, but for the way down to what is not.
    const children = new Map<string | null, typeof all>();
    for (const node of all)
      children.set(node.parentPath, [
        ...(children.get(node.parentPath) ?? []),
        node,
      ]);
    const kept = new Set<string>();
    const keep = (node: (typeof all)[number]): boolean => {
      const under = (children.get(node.path) ?? []).map(keep).some(Boolean);
      const wanted = under || (SHOWABLE.has(node.kind) && !isDrawn(node.path));
      if (wanted) kept.add(node.path);
      return wanted;
    };
    for (const node of children.get(null) ?? []) keep(node);
    return all.filter(({ path }) => kept.has(path));
  }, [document, isDrawn]);
  const inactive = useMemo<TreeInactive | undefined>(
    () =>
      isDrawn === undefined
        ? undefined
        : {
            is: (node) => SHOWABLE.has(node.kind) && isDrawn(node.path),
            note: 'On the diagram',
          },
    [isDrawn],
  );
  const [query, setQuery] = useState('');
  const tree = useRef<HTMLDivElement>(null);
  const toggling = useMemo<TreeToggling | undefined>(
    () =>
      isShown === undefined || onShow === undefined
        ? undefined
        : {
            isOn: (node) =>
              SHOWABLE.has(node.kind) ? isShown(node.path) : null,
            onToggle: (node) => onShow(node.path, !isShown(node.path)),
          },
    [isShown, onShow],
  );
  const kinds = useMemo(
    () => new Map(nodes.map(({ path, kind }) => [path, kind])),
    [nodes],
  );
  const onSelect = useCallback(
    (path: string, source: SelectSource) => {
      if (onPick === undefined || source !== 'tree') return;
      const kind = kinds.get(path);
      if (kind !== undefined && SHOWABLE.has(kind) && isDrawn?.(path) !== true)
        onPick(path);
    },
    [onPick, kinds, isDrawn],
  );
  const controller = useModelTree(nodes, {
    // Nothing is read here: a row is put in or taken out, or picked.
    selected: null,
    onSelect,
    query,
    onQuery: setQuery,
    opensAtTop: false,
  });

  const intoTree = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    tree.current
      ?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]')
      ?.focus();
  };

  return (
    <Stack gap={0} flex={1} mih={0}>
      <Box p="sm" className={classes.box}>
        <TextInput
          size="sm"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={intoTree}
          aria-label="Filter the model"
          // Where a focus trap opening round it puts the focus first.
          data-autofocus
          placeholder="Filter the model by name or pattern"
          leftSection={<IconSearch size={16} stroke={1.6} aria-hidden />}
          rightSection={
            query === '' ? null : (
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label="Clear the filter"
                onClick={() => setQuery('')}
              >
                <IconX size={14} stroke={1.6} aria-hidden />
              </ActionIcon>
            )
          }
        />
      </Box>
      <Box ref={tree} px="xs" py={6} flex={1} className={classes.tree}>
        <Outline
          controller={controller}
          label="The model"
          empty="The model holds no elements."
          nothingFound="Nothing in the model is called that."
          toggling={toggling}
          inactive={inactive}
        />
      </Box>
    </Stack>
  );
}
