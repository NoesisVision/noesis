import { IconArrowsDiagonalMinimize2 } from '@tabler/icons-react';
import { type ReactNode, useMemo } from 'react';
import type { OutlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { DesignDocumentContext } from '../element-details/design-document-context.ts';
import { ElementNavigationContext } from '../element-details/element-navigation.ts';
import { GlanceReadingContext } from '../element-details/glance-reading.ts';
import classes from './architecture-details.module.css';

export interface DetailsPanelProps {
  document: DesignDocumentInput;
  /** The model's own tree, which an element's body sections read through. */
  modelTree: OutlineTree;
  onSelectElement: (id: string) => void;
  /** Read at a glance, over its card: smaller type, descriptions folded. */
  glance?: boolean;
  /** Shrinks the panel out of the way; without it there is no such button. */
  onMinimize?: () => void;
  eyebrow: string;
  title: string;
  address?: string;
  children: ReactNode;
}

/*
 * The frame a selection is read in on a canvas: what it is and its name,
 * stuck to the top with the way to put it aside, where it sits, then what it
 * says. It has no close button: the selection is let go of on the canvas.
 * A type named in it is opened as a card is.
 *
 * The page heading is the document's; the subject here is an `h2`, its parts
 * `h3`s.
 */
export function DetailsPanel({
  document,
  modelTree,
  onSelectElement,
  glance = false,
  onMinimize,
  eyebrow,
  title,
  address,
  children,
}: DetailsPanelProps) {
  const navigation = useMemo(
    () => ({
      has: (path: string) => modelTree.byPath.has(path),
      select: onSelectElement,
    }),
    [modelTree, onSelectElement],
  );
  return (
    <DesignDocumentContext.Provider value={document}>
      <ElementNavigationContext.Provider value={navigation}>
        <GlanceReadingContext.Provider value={glance}>
          <Stack gap="md" p="md" data-glance={glance || undefined}>
            {/* What is in hand and the way to put it aside, kept in view over
                whatever the panel is scrolled to. */}
            <Group
              component="header"
              align="flex-start"
              gap="xs"
              wrap="nowrap"
              className={classes.head}
            >
              <Stack gap={2} flex={1} miw={0}>
                <Text
                  component="span"
                  fz={11}
                  fw={600}
                  lts="0.06em"
                  tt="uppercase"
                  c="var(--noesis-secondary-text)"
                >
                  {eyebrow}
                </Text>
                <Title order={2} size="h4" className={classes.wraps}>
                  {title}
                </Title>
              </Stack>
              {onMinimize !== undefined && (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label="Minimize the details"
                  title="Minimize the details"
                  onClick={onMinimize}
                >
                  <IconArrowsDiagonalMinimize2
                    size={18}
                    stroke={1.6}
                    aria-hidden
                  />
                </ActionIcon>
              )}
            </Group>
            {/* Small and gray, as the element tooltip says where an element sits. */}
            {address !== undefined && (
              <Text
                component="span"
                fz="xs"
                mt="calc(-1 * var(--mantine-spacing-sm))"
                className={`${classes.wraps} ${classes.address}`}
              >
                {address}
              </Text>
            )}
            {/* Apart as the model's own sections are. */}
            <Stack gap="xl">{children}</Stack>
          </Stack>
        </GlanceReadingContext.Provider>
      </ElementNavigationContext.Provider>
    </DesignDocumentContext.Provider>
  );
}
