import { IconAffiliate, IconPlus, IconX } from '@tabler/icons-react';
import { useId } from 'react';
import { ElementSearch } from '#/features/design-docs/element-reader.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Popover } from '#/shared/design-system/popover.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { ThemeIcon } from '#/shared/design-system/theme-icon.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { useThemedSurface } from './themes/diagram-theme-context.ts';
import classes from './exploration.module.css';

export interface ExplorationPickerProps {
  opened: boolean;
  onOpened: (opened: boolean) => void;
  /** How many elements are drawn, and how many the model holds. */
  drawn: number;
  total: number;
  document: DesignDocumentInput;
  isShown: (id: string) => boolean;
  /** A row clicked: the element alone, then with all inside it, then none. */
  onPick: (id: string) => void;
  /** Draws every element of the model. */
  onAddAll: () => void;
  /** Draws nothing again. */
  onClear: () => void;
}

/*
 * What the exploration draws, chosen in one place: the model's tree, each
 * element ticked in or out. It opens from a button in the middle of an empty canvas,
 * or from the plus at the canvas's foot once something is drawn, and opens
 * above that plus either way.
 */
export function ExplorationPicker({
  opened,
  onOpened,
  drawn,
  total,
  document,
  isShown,
  onPick,
  onAddAll,
  onClear,
}: ExplorationPickerProps) {
  const empty = drawn === 0;
  const title = useId();
  const surface = useThemedSurface('picker', `nowheel nopan ${classes.picker}`);
  return (
    <>
      {empty && (
        <Stack
          align="center"
          gap="sm"
          maw={420}
          className={classes.start}
          data-part="start"
        >
          <ThemeIcon size={56} radius="md" variant="light" aria-hidden>
            <IconAffiliate size={28} stroke={1.6} />
          </ThemeIcon>
          <Title order={2} size="h4">
            Nothing drawn yet
          </Title>
          <Text fz="sm" ta="center" c="var(--noesis-secondary-text)">
            Pick elements from the model, or right-click the canvas to put one
            where you click. The relations between them are drawn too.
          </Text>
          <Button
            size="md"
            mt={6}
            leftSection={<IconPlus size={20} stroke={2} aria-hidden />}
            aria-haspopup="dialog"
            aria-expanded={opened}
            onClick={() => onOpened(!opened)}
          >
            Start exploration
          </Button>
          <Text fz="xs" c="var(--noesis-secondary-text)">
            {`${total} elements in the model`}
          </Text>
        </Stack>
      )}
      <Popover
        opened={opened}
        onChange={onOpened}
        position="top"
        offset={16}
        shadow="xl"
        trapFocus
        returnFocus
        // The canvas stops a mouse press from reaching the page; a pointer's does.
        clickOutsideEvents={['pointerdown']}
      >
        <Popover.Target>
          <Box className={classes.anchor}>
            {!empty && (
              <ActionIcon
                size={56}
                radius="xl"
                variant="filled"
                color={opened ? 'dark' : undefined}
                aria-label={opened ? 'Close' : 'Add to the exploration'}
                title={opened ? 'Close' : 'Add to the exploration'}
                aria-haspopup="dialog"
                aria-expanded={opened}
                className={classes.plus}
                data-part="add"
                onClick={() => onOpened(!opened)}
              >
                {opened ? (
                  <IconX size={26} stroke={2} aria-hidden />
                ) : (
                  <IconPlus size={26} stroke={2} aria-hidden />
                )}
              </ActionIcon>
            )}
          </Box>
        </Popover.Target>
        <Popover.Dropdown
          p={0}
          // Named for what it does, not after the button that opens it,
          // which reads Close while it is open.
          aria-labelledby={title}
          {...surface}
        >
          <VisuallyHidden id={title}>Add to the exploration</VisuallyHidden>
          <ElementSearch
            document={document}
            isShown={isShown}
            onShow={(id) => onPick(id)}
          />
          <Group
            gap="md"
            wrap="nowrap"
            px="md"
            py={10}
            className={classes.pickerFoot}
          >
            <Text fz="xs" c="var(--noesis-secondary-text)" flex={1}>
              Click once to draw an element, again for all inside it, once more
              to take them off.
            </Text>
            <Text component="output" fz="sm" className={classes.drawnCount}>
              <b>{drawn}</b>
              {` of ${total} drawn`}
            </Text>
            <Button
              size="xs"
              variant="default"
              disabled={drawn === total}
              onClick={onAddAll}
            >
              Add all
            </Button>
            <Button
              size="xs"
              variant="default"
              disabled={empty}
              onClick={onClear}
            >
              Clear
            </Button>
            <Button size="xs" onClick={() => onOpened(false)}>
              Done
            </Button>
          </Group>
        </Popover.Dropdown>
      </Popover>
    </>
  );
}
