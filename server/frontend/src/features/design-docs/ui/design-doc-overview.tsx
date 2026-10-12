import { type MouseEvent, useCallback, useMemo } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import {
  type DescriptionTarget,
  descriptionTargets,
  readableDescription,
  targetOfHref,
} from '../design-doc-description.ts';
import type { DesignDocDetail } from '../design-docs.api.ts';
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
      <Box className={classes.body} onClickCapture={onClickCapture}>
        <VisuallyHidden>
          <Title order={2}>Overview</Title>
        </VisuallyHidden>
        {doc.description.trim() === '' ? (
          <Text c="dimmed" size="sm">
            This design has no overview yet.
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
