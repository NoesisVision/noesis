import {
  IconMaximize,
  IconMinimize,
  IconViewportNarrow,
  IconViewportWide,
} from '@tabler/icons-react';
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import {
  useFullscreenElement,
  useLocalStorage,
  useMergedRef,
} from '#/shared/design-system/hooks.ts';
import { SegmentedControl } from '#/shared/design-system/segmented-control.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { type IconComponent, IconHeading } from '#/shared/ui/icon-heading.tsx';
import classes from './reading-pane.module.css';

/** The two measures a document is read at, in the order the switch shows them. */
const WIDTHS = [
  {
    value: 'convenient' as const,
    label: 'Convenient',
    icon: IconViewportNarrow,
  },
  { value: 'full' as const, label: 'Full width', icon: IconViewportWide },
];

/** Centred at a measure a line can be followed at, or all the room there is. */
type ReadingWidth = (typeof WIDTHS)[number]['value'];

/** The same `noesis.shell.*` namespace the colour scheme is stored under. */
const WIDTH_KEY = 'noesis.shell.readingWidth';

/** What a reader who has never touched the switch gets. */
const DEFAULT_WIDTH: ReadingWidth = 'convenient';

/**
 * A width left in storage by another version of the app must not decide how a
 * page is laid out, so anything the switch does not offer reads as the
 * default. Values are stored as JSON, which is what is compared here.
 */
function toReadingWidth(stored: string | undefined): ReadingWidth {
  return (
    WIDTHS.find(({ value }) => stored === JSON.stringify(value))?.value ??
    DEFAULT_WIDTH
  );
}

interface ReadingPaneProps {
  /** The item the page is about: a document's title, a design's name. */
  title: ReactNode;
  /** The icon of the kind, as the domain exports it. */
  icon: IconComponent;
  /** A line under the title, for what the item is rather than what it says. */
  description?: ReactNode;
  /** The document itself, laid out under the heading. */
  children: ReactNode;
}

/**
 * Whether the document has moved under the header, so it can draw the edge
 * that says the page carries on beneath it.
 *
 * The header rests at the very offset it sticks to, so where it sits says
 * nothing about whether it is holding anything back; what the reader has
 * scrolled does. Either scroller counts — the pane's own in full screen, the
 * page's otherwise — and a scroll event does not bubble but is seen on the way
 * down, so one capturing listener hears whichever of the two it was.
 */
function useScrolledUnder(pane: RefObject<HTMLDivElement | null>): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const read = () =>
      setScrolled(
        Math.max(
          document.scrollingElement?.scrollTop ?? 0,
          pane.current?.scrollTop ?? 0,
        ) > 0,
      );

    read();
    document.addEventListener('scroll', read, { capture: true, passive: true });
    // Leaving full screen hands the scrolling back to the page.
    document.addEventListener('fullscreenchange', read);
    return () => {
      document.removeEventListener('scroll', read, { capture: true });
      document.removeEventListener('fullscreenchange', read);
    };
  }, [pane]);

  return scrolled;
}

/**
 * The surface a whole document is read on: its heading, and above it the
 * controls for how much of the window it takes. Full screen is the browser's
 * own, asked for on this element, so the shell around it is simply not painted
 * rather than told to hide.
 */
export function ReadingPane({
  title,
  icon,
  description,
  children,
}: ReadingPaneProps) {
  const [width, setWidth] = useLocalStorage<ReadingWidth>({
    key: WIDTH_KEY,
    defaultValue: DEFAULT_WIDTH,
    deserialize: toReadingWidth,
    // Nothing renders on a server here, so the stored width can be read while
    // the first paint is drawn rather than corrected after it.
    getInitialValueInEffect: false,
  });
  const { ref, toggle, fullscreen } = useFullscreenElement<HTMLDivElement>();
  const fullscreenLabel = fullscreen ? 'Exit full screen' : 'Full screen';
  // A browser that refuses the request leaves the pane as it is, which is the
  // state the button already shows, so there is nothing to report.
  const toggleFullscreen = () => void toggle().catch(() => {});
  // The pane is both what goes full screen and what scrolls while it is.
  const pane = useRef<HTMLDivElement>(null);
  const paneRef = useMergedRef(ref, pane);
  const stuck = useScrolledUnder(pane);

  return (
    <Box component="article" ref={paneRef} className={classes.surface}>
      <Box
        className={classes.header}
        data-width={width}
        data-stuck={stuck || undefined}
      >
        <Box className={classes.headerColumn}>
          <IconHeading title={title} icon={icon} description={description} />
        </Box>
        {/* A phone has one width to read at and no chrome worth hiding; the
            same breakpoint the shell folds its sidebar at. */}
        <Group
          gap="xs"
          wrap="nowrap"
          visibleFrom="md"
          className={classes.controls}
        >
          <SegmentedControl
            aria-label="Content width"
            size="md"
            value={width}
            onChange={setWidth}
            data={WIDTHS.map(({ value, label, icon: Icon }) => ({
              value,
              // The glyph says it at a glance; the name says it to a reader
              // who cannot see the glyph.
              label: (
                <>
                  <Icon
                    size={22}
                    stroke={1.6}
                    className={classes.segmentIcon}
                    aria-hidden
                  />
                  <VisuallyHidden>{label}</VisuallyHidden>
                </>
              ),
            }))}
          />
          <ActionIcon
            variant="default"
            size="lg"
            aria-label={fullscreenLabel}
            title={fullscreenLabel}
            onClick={toggleFullscreen}
          >
            {fullscreen ? (
              <IconMinimize size={22} stroke={1.6} aria-hidden />
            ) : (
              <IconMaximize size={22} stroke={1.6} aria-hidden />
            )}
          </ActionIcon>
        </Group>
      </Box>
      <Box className={classes.column} data-width={width}>
        <Stack>{children}</Stack>
      </Box>
    </Box>
  );
}
