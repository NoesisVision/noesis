import { IconFileText } from '@tabler/icons-react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { designDocsList } from '#/features/design-docs/design-docs.api.ts';
import {
  DESIGN_DOCS_TONE,
  DesignDocsIcon,
} from '#/features/design-docs/design-docs.model.ts';
import { documentsList } from '#/features/documents/documents.api.ts';
import { DocumentsIcon } from '#/features/documents/documents.model.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { Card } from '#/shared/design-system/card.tsx';
import { FormattedDate } from '#/shared/ui/formatted-date.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import { TileLink } from '#/shared/ui/tile-link.tsx';
import { useChangeId } from '../../current-change.ts';
import { OverviewSection } from './overview-section.tsx';
import classes from './overview.module.css';

// The change layout loads the change once for every view under it.
const changeRoute = getRouteApi('/_shell/changes/$changeId');

/**
 * What a change holds, on one card: what it is about, then its documents and
 * its design docs, each a tile that opens it.
 */
export function OverviewView() {
  const { changeId } = useChangeId();
  const { change } = changeRoute.useLoaderData();
  const documents = useQuery(documentsList(changeId));
  const designDocs = useQuery(designDocsList(changeId));

  return (
    <Card withBorder radius="xl" padding="xl" className={classes.card}>
      <Box className={classes.content}>
        {!!change.description && (
          <Box className={classes.description}>
            <MarkdownEditor readOnly markdown={change.description} noMargin />
          </Box>
        )}
        <OverviewSection
          title="Documents"
          icon={DocumentsIcon}
          count={documents.data?.length}
          empty={emptyText(documents, 'documents')}
        >
          {changeId &&
            (documents.data ?? []).map((document) => (
              <TileLink
                key={document.id}
                to="/changes/$changeId/documents/$documentId"
                params={{ changeId, documentId: document.id }}
                title={document.title}
                icon={IconFileText}
                kind="Document"
                meta={<FormattedDate value={document.date} />}
              />
            ))}
        </OverviewSection>
        <OverviewSection
          title="Design docs"
          icon={DesignDocsIcon}
          count={designDocs.data?.length}
          empty={emptyText(designDocs, 'design documents')}
        >
          {changeId &&
            (designDocs.data ?? []).map((doc) => (
              <TileLink
                key={doc.id}
                to="/changes/$changeId/design-docs/$docId"
                params={{ changeId, docId: doc.id }}
                title={doc.name}
                icon={DesignDocsIcon}
                tone={DESIGN_DOCS_TONE}
                kind="Design doc"
                meta={doc.implemented ? 'Implemented' : 'Draft'}
                metaItalic
                dot
              />
            ))}
        </OverviewSection>
      </Box>
    </Card>
  );
}

// A failure never reaches here: it is thrown to the route's boundary.
function emptyText(query: UseQueryResult<unknown>, what: string): string {
  if (query.isPending) return `Loading ${what}…`;
  return `No ${what} yet for this change.`;
}
