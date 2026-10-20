import { IconX } from '@tabler/icons-react';
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
  /** Clears the selection; without it — over a card, say — there is no close button. */
  onClear?: () => void;
  /** Read at a glance, over its card: smaller type, descriptions folded. */
  glance?: boolean;
  eyebrow: string;
  title: string;
  address?: string;
  children: ReactNode;
}

/*
 * The frame a selection is read in on a canvas: what it is and its name,
 * stuck to the top with the way out of it, where it sits, then what it says.
 * A type named in it is opened as a card is.
 *
 * The page heading is the document's; the subject here is an `h2`, its parts
 * `h3`s.
 */
export function DetailsPanel({
  document,
  modelTree,
  onSelectElement,
  onClear,
  glance = false,
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
            {/* What is in hand and the way out of it, kept in view over
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
              {onClear !== undefined && (
                <ActionIcon
                  variant="subtle"
                  aria-label="Clear the selection"
                  title="Clear the selection"
                  onClick={onClear}
                >
                  <IconX size={18} stroke={1.6} aria-hidden />
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
            {children}
          </Stack>
        </GlanceReadingContext.Provider>
      </ElementNavigationContext.Provider>
    </DesignDocumentContext.Provider>
  );
}
