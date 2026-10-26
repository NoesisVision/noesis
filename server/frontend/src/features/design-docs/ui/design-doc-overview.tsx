import { clsx } from 'clsx';
import { type MouseEvent, useCallback, useMemo } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Card } from '#/shared/design-system/card.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import { SideCard, SideRow, SideRows } from '#/shared/ui/side-card.tsx';
import {
  type DescriptionTarget,
  descriptionTargets,
  type LinkedTarget,
  linkedTargets,
  linkedViews,
  readableDescription,
  targetOfHref,
} from '../design-doc-description.ts';
import type { DesignDocDetail } from '../design-docs.api.ts';
import { DESIGN_DOC_VIEW_ICONS } from '../design-docs.model.ts';
import prose from '#/shared/ui/prose.module.css';
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
  const targets = useMemo(
    () => linkedTargets(doc.description, resolve),
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
        <Card
          withBorder
          className={clsx(classes.body, prose.prose)}
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
        {views.length > 0 && (
          <Stack
            component="aside"
            aria-label="Linked from the overview"
            gap={14}
            className={classes.aside}
          >
            <LinkLegend views={views} />
            {views.map((view) => (
              <LinkedList
                key={view}
                view={view}
                targets={targets.filter(({ target }) => target.view === view)}
                onOpen={onOpen}
              />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

const OPENS_IN_LABEL: Record<DescriptionTarget['view'], string> = {
  model: 'opens in Model',
  requirements: 'opens in Requirements',
};

/** What each kind of link looks like, as the chips in the prose draw them. */
function LinkLegend({ views }: { views: DescriptionTarget['view'][] }) {
  return (
    <SideCard title="Links">
      <Group gap={6}>
        {views.map((view) => {
          const Icon = DESIGN_DOC_VIEW_ICONS[view];
          return (
            <Box
              key={view}
              component="span"
              className={classes.chip}
              data-view={view}
            >
              <Icon size={12} stroke={2} aria-hidden />
              {OPENS_IN_LABEL[view]}
            </Box>
          );
        })}
      </Group>
    </SideCard>
  );
}

const LIST_TITLE: Record<DescriptionTarget['view'], string> = {
  model: 'Model elements',
  requirements: 'Requirements',
};

/** Every element, or every need, the overview links to, each opening it. */
function LinkedList({
  view,
  targets,
  onOpen,
}: {
  view: DescriptionTarget['view'];
  targets: LinkedTarget[];
  onOpen: (target: DescriptionTarget) => void;
}) {
  const Icon = DESIGN_DOC_VIEW_ICONS[view];
  return (
    <SideCard title={LIST_TITLE[view]} count={targets.length}>
      <SideRows>
        {targets.map(({ label, target }) => (
          <SideRow
            key={target.view === 'model' ? target.node : target.entry}
            data-view={view}
            icon={<Icon size={14} stroke={1.8} aria-hidden />}
            label={label}
            onClick={() => onOpen(target)}
          />
        ))}
      </SideRows>
    </SideCard>
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
