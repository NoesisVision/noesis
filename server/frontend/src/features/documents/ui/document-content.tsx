import { IconExternalLink, IconHash } from '@tabler/icons-react';
import { clsx } from 'clsx';
import { useMemo, useRef } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Card } from '#/shared/design-system/card.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { FormattedDate } from '#/shared/ui/formatted-date.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import { ReadingPane } from '#/shared/ui/reading-pane.tsx';
import { SideCard, SideRow, SideRows } from '#/shared/ui/side-card.tsx';
import type { Document } from '#backend/app/information-sources/document.ts';
import { documentHeadings, documentLinks } from '../document-outline.ts';
import { DOCUMENTS_TONE } from '../documents.model.ts';
import { headingIn, useCurrentSection } from './use-current-section.ts';
import prose from '#/shared/ui/prose.module.css';
import classes from './document-content.module.css';

/**
 * The document is imported material: its markdown is shown as written, read
 * as a design's overview is — the same type in the same card — with what it
 * is made of and where it points beside it, on the right, staying in view as
 * it is read and marking the section being read.
 */
export function DocumentContent({ document: doc }: { document: Document }) {
  const body = useRef<HTMLDivElement>(null);
  const headings = useMemo(() => documentHeadings(doc.content), [doc.content]);
  const links = useMemo(() => documentLinks(doc.content), [doc.content]);
  const empty = doc.content.trim() === '';
  const current = useCurrentSection(body, headings);

  return (
    <ReadingPane
      tone={DOCUMENTS_TONE}
      eyebrow="Document"
      title={doc.title}
      meta={<FormattedDate value={doc.date} />}
    >
      <Box className={classes.layout}>
        <Card ref={body} withBorder className={clsx(classes.body, prose.prose)}>
          {empty ? (
            <Text c="dimmed">This document is empty.</Text>
          ) : (
            // The editor reads its markdown once, so a different document is a
            // different editor rather than the same one told to change.
            <MarkdownEditor key={doc.id} markdown={doc.content} readOnly />
          )}
        </Card>
        {(headings.length > 0 || links.length > 0) && (
          <Stack
            component="aside"
            aria-label="About this document"
            gap={14}
            className={classes.aside}
          >
            {headings.length > 0 && (
              <SideCard title="Contents" count={headings.length}>
                <SideRows>
                  {headings.map((heading, index) => (
                    <Box
                      // Headings have no identity but their place.
                      // oxlint-disable-next-line react/no-array-index-key
                      key={index}
                      className={classes.entry}
                      data-depth={heading.depth}
                    >
                      <SideRow
                        icon={<IconHash size={14} stroke={1.8} aria-hidden />}
                        label={heading.text}
                        current={index === current}
                        onClick={() =>
                          headingIn(
                            body.current,
                            headings,
                            index,
                          )?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                        }
                      />
                    </Box>
                  ))}
                </SideRows>
              </SideCard>
            )}
            {links.length > 0 && (
              <SideCard title="Links" count={links.length}>
                <SideRows>
                  {links.map((link) => (
                    <SideRow
                      key={link.href}
                      href={link.href}
                      icon={
                        <IconExternalLink size={14} stroke={1.8} aria-hidden />
                      }
                      label={link.label}
                    />
                  ))}
                </SideRows>
              </SideCard>
            )}
          </Stack>
        )}
      </Box>
    </ReadingPane>
  );
}
