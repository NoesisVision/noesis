import { type MouseEvent, useCallback, useMemo } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Card } from '#/shared/design-system/card.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import {
  type DescriptionTarget,
  descriptionTargets,
  linkedViews,
  readableDescription,
  targetOfHref,
} from '../design-doc-description.ts';
import type { DesignDocDetail } from '../design-docs.api.ts';
import { DESIGN_DOC_VIEW_ICONS } from '../design-docs.model.ts';
import classes from './design-doc-overview.module.css';

/**
 * The design read from the top: what it changes in the model and where to
 * start reading, the view a reader meets on opening it. It is about the whole
 * design, so it stands beside the other views rather than inside one: a link
 * to an element opens the model on it, one to a need opens the requirements
 * on it, and any other is read as words.
 *
 * The switch above already names the view, so its heading is for the
 * outline of the page only.
 */
export function DesignDocOverview({
  detail,
  onOpen,
}: {
  detail: DesignDocDetail;
  onOpen: (target: DescriptionTarget) => void;
}) {
  const { document: doc, outline } = detail;
  const rows = useMemo(
    () => new Set(outline.map(({ path }) => path)),
    [outline],
  );
  const has = useCallback((path: string) => rows.has(path), [rows]);
  const resolve = useMemo(() => descriptionTargets(has, doc), [has, doc]);
  const page = pageAddress();
  const markdown = useMemo(
    () => readableDescription(doc.description, resolve, page),
    [doc.description, resolve, page],
  );
  const views = useMemo(
    () => linkedViews(doc.description, resolve),
    [doc.description, resolve],
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
    <Box className={classes.pane}>
      <Box className={classes.layout}>
        {views.length > 0 && <LinkLegend views={views} />}
        <Card
          withBorder
          className={classes.body}
          onClickCapture={onClickCapture}
        >
          <VisuallyHidden>
            <Title order={2}>Overview</Title>
          </VisuallyHidden>
          {doc.description.trim() === '' ? (
            <Text c="dimmed" size="sm">
              This design has no overview yet.
            </Text>
          ) : (
            // Read as a document is read on its own page: the same editor,
            // the same type, in the same card.
            <MarkdownEditor markdown={markdown} readOnly />
          )}
        </Card>
      </Box>
    </Box>
  );
}

const OPENS_IN_LABEL: Record<DescriptionTarget['view'], string> = {
  model: 'opens in Model',
  requirements: 'opens in Requirements',
};

/**
 * What the two link icons mean, beside the prose while there is room for it
 * and above it where there is not. Only the kinds of link the overview has
 * are listed.
 */
function LinkLegend({ views }: { views: DescriptionTarget['view'][] }) {
  return (
    <Box component="aside" aria-label="Links" className={classes.legend}>
      <Text size="xs" fw={600} c="dimmed" className={classes.legendTitle}>
        Links
      </Text>
      <Stack gap={4} className={classes.legendItems}>
        {views.map((view) => {
          const Icon = DESIGN_DOC_VIEW_ICONS[view];
          return (
            <Group key={view} gap={6} wrap="nowrap">
              <Icon size={14} stroke={1.8} aria-hidden />
              <Text size="xs" c="dimmed">
                {OPENS_IN_LABEL[view]}
              </Text>
            </Group>
          );
        })}
      </Stack>
    </Box>
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
