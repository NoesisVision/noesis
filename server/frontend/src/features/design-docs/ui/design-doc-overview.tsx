import { IconFileDescription } from '@tabler/icons-react';
import { type MouseEvent, useMemo } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Divider } from '#/shared/design-system/divider.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { NavLink } from '#/shared/design-system/nav-link.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import {
  elementOfHref,
  readableDescription,
} from '../design-doc-description.ts';

const OverviewIcon = IconFileDescription;

/**
 * The way back to the overview, above the outline: the one place in the
 * panel's reach that is about the design as a whole rather than an element.
 */
export function OverviewLink({
  active,
  onOpen,
}: {
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <NavLink
      component="button"
      label="Overview"
      leftSection={<OverviewIcon size={18} stroke={1.6} aria-hidden />}
      active={active}
      aria-current={active ? 'location' : undefined}
      onClick={onOpen}
    />
  );
}

/**
 * What the design decides, in a few lines, and where: the first thing a reader
 * meets on opening a design. A link to an element the outline has opens it in
 * the outline; any other is read as words.
 */
export function DesignDocOverview({
  description,
  has,
  onSelect,
}: {
  description: string;
  has: (path: string) => boolean;
  onSelect: (path: string) => void;
}) {
  const page = pageAddress();
  const markdown = useMemo(
    () => readableDescription(description, has, page),
    [description, has, page],
  );
  // The links are the editor's own anchors; the page takes the click from
  // them, so the reader stays on it rather than reloading it.
  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!(event.target instanceof Element)) return;
    const href = event.target.closest('a')?.getAttribute('href');
    const element = href ? elementOfHref(href, page) : null;
    if (element === null || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(element);
  };

  return (
    <>
      <Group gap="xs" px="md" py="sm" wrap="nowrap">
        <OverviewIcon size={22} stroke={1.6} aria-hidden />
        <Title order={2} size="h3">
          Overview
        </Title>
      </Group>
      <Divider />
      <Box px="md" pt="sm" onClickCapture={onClickCapture}>
        {description.trim() === '' ? (
          <Text c="dimmed" size="sm">
            This design has no description yet.
          </Text>
        ) : (
          <MarkdownEditor
            markdown={markdown}
            headingLevel={3}
            readOnly
            noMargin
          />
        )}
      </Box>
    </>
  );
}

// Where this design is open, without what is being read in it; rendered off
// a browser, any address will do.
function pageAddress(): string {
  const location = globalThis.window?.location;
  return location
    ? `${location.origin}${location.pathname}`
    : 'http://localhost/';
}
