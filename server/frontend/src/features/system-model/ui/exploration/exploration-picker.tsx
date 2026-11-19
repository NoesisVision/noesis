import { IconAffiliate, IconPlus, IconX } from '@tabler/icons-react';
import { useId, useState } from 'react';
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
import type { HowMuchDrawn } from '../../system-model-exploration.ts';
import { useThemedSurface } from './themes/diagram-theme-context.ts';
import classes from './exploration.module.css';

export interface ExplorationPickerProps {
  opened: boolean;
  onOpened: (opened: boolean) => void;
  /** How many elements are drawn, and how many the model holds. */
  drawn: number;
  total: number;
  document: DesignDocumentInput;
  /** How much of an element is drawn, with all inside it: its row's tick, a dash for only part. */
  isShown: (id: string) => HowMuchDrawn;
  /** A row clicked: the element alone, then with all inside it, then none. */
  onPick: (id: string) => void;
  /** Draws every element of the model. */
  onAddAll: () => void;
  /** Draws nothing again. */
  onClear: () => void;
}

/*
 * What the exploration draws, chosen in one place: the model's tree, each
 * element ticked in or out — a dash in its box while only part of it and
 * what is inside it is drawn. It opens from a button in the middle of an
 * empty canvas, in the middle of that canvas, and stays there until it is
 * shut, though what is picked in it is drawn behind it. Once something is
 * drawn it opens from the plus in the canvas's bottom right corner, above
 * that plus, from the corner inwards.
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
  // Opened on an empty canvas, it is in the canvas's middle for as long as
  // it is open, and until it has faded once shut: the first element picked
  // would else send it to the corner under the reader's hand.
  const [centred, setCentred] = useState(false);
  const [wasOpened, setWasOpened] = useState(opened);
  if (opened !== wasOpened) {
    setWasOpened(opened);
    if (opened) setCentred(empty);
  }
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
        position={centred ? 'top' : 'top-end'}
        offset={16}
        onExitTransitionEnd={() => setCentred(false)}
        // The picker's own width (exploration.module.css): the popover would
        // else set it as wide as its longest line.
        width="min(480px, calc(100vw - 32px))"
        shadow="xl"
        trapFocus
        returnFocus
        // The canvas stops a mouse press from reaching the page; a pointer's does.
        clickOutsideEvents={['pointerdown']}
      >
        <Popover.Target>
          <Box className={classes.anchor} data-centred={centred || undefined}>
            {/* The plus is the corner's: with the picker in the middle, it waits. */}
            {!empty && !centred && (
              <ActionIcon
                size={56}
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
          {/* At the picker's width the hint has a line of its own, over the count and the buttons. */}
          <Stack gap={8} px="md" py={10} className={classes.pickerFoot}>
            <Text fz="xs" c="var(--noesis-secondary-text)">
              Click once to draw an element, again for all inside it, once more
              to take them off.
            </Text>
            <Group gap="xs" wrap="nowrap">
              <Text
                component="output"
                fz="sm"
                flex={1}
                className={classes.drawnCount}
              >
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
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </>
  );
}
