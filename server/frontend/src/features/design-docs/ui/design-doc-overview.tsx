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
  type DescriptionTarget,
  readableDescription,
  targetOfHref,
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
 * The design read from the top: what it changes in the model and where to
 * start reading, the first thing a reader meets on opening it. A link to an
 * element the outline has opens it in the outline, one to a need opens the
 * requirements on it; any other is read as words.
 */
export function DesignDocOverview({
  description,
  resolve,
  onOpen,
}: {
  description: string;
  resolve: (target: string) => DescriptionTarget | null;
  onOpen: (target: DescriptionTarget) => void;
}) {
  const page = pageAddress();
  const markdown = useMemo(
    () => readableDescription(description, resolve, page),
    [description, resolve, page],
  );
  // The links are the editor's own anchors; the page takes the click from
  // them, so the reader stays on it rather than reloading it.
  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!(event.target instanceof Element)) return;
    const href = event.target.closest('a')?.getAttribute('href');
    const target = href ? targetOfHref(href, page) : null;
    if (target === null || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    event.stopPropagation();
    onOpen(target);
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
