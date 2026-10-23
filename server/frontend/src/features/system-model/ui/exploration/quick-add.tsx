import { ElementSearch } from '#/features/design-docs/element-reader.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { Popover } from '#/shared/design-system/popover.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import classes from './exploration.module.css';

/** Where on the canvas the reader right-clicked, in its own pixels. */
export interface QuickAddSpot {
  left: number;
  top: number;
}

/*
 * A light menu where the reader right-clicked an empty part of the canvas:
 * the model's tree under a search box, which takes the focus, and nothing to
 * tick. The element a row stands for, clicked, is put on the diagram there.
 * What is drawn already is left out, or greyed when something under it is
 * not, to be opened rather than picked.
 */
export function QuickAdd({
  spot,
  document,
  isDrawn,
  onPick,
  onClose,
}: {
  spot: QuickAddSpot | null;
  document: DesignDocumentInput;
  /** Whether the diagram draws an element already, so the menu leaves it out. */
  isDrawn: (id: string) => boolean;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Popover
      opened={spot !== null}
      onChange={(opened) => {
        if (!opened) onClose();
      }}
      position="bottom-start"
      offset={4}
      shadow="md"
      radius="md"
      trapFocus
      // The canvas stops a mouse press from reaching the page; a pointer's does.
      clickOutsideEvents={['pointerdown']}
    >
      <Popover.Target>
        <Box
          className={classes.quickSpot}
          style={{ left: spot?.left ?? 0, top: spot?.top ?? 0 }}
        />
      </Popover.Target>
      <Popover.Dropdown
        p={0}
        aria-label="Add an element here"
        className={`nowheel nopan ${classes.quickAdd}`}
      >
        <ElementSearch document={document} isDrawn={isDrawn} onPick={onPick} />
      </Popover.Dropdown>
    </Popover>
  );
}
