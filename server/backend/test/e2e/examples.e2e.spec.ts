// The sample repositories under examples/ carry a knowledge graph the service
// must keep reading: every change, design document and document in them is
// served, so a schema change that strands one fails here, not in a demo.
import { describe, expect, it } from 'bun:test';
import { resolve } from 'node:path';
import { NoesisChangesRepository } from '#backend/adapters/store/changes.repository';
import { NoesisDesignDocsRepository } from '#backend/adapters/store/design-docs.repository';
import { NoesisDocumentsRepository } from '#backend/adapters/store/documents.repository';
import { createApp } from '#backend/app';
import { ChangesService } from '#backend/app/changes/changes.service';
import { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import { DocumentsService } from '#backend/app/information-sources/documents.service';
import { SearchService } from '#backend/app/search/search.service';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

const EXAMPLES = resolve(__dirname, '../../../../examples');

interface ExpectedChange {
  designDocs: number;
  documents: number;
}

const EXAMPLE_REPOSITORIES: Record<string, Record<string, ExpectedChange>> = {
  'discounts-java': {
    'weather-based-discount': { designDocs: 1, documents: 2 },
  },
  'ddd-starter-dotnet': {
    'order-persistence-and-risk-integration': { designDocs: 1, documents: 1 },
    'threshold-activated-discount': { designDocs: 1, documents: 2 },
  },
};

// Read only: the repositories open nothing that is not there, so the checkout
// stays as committed.
function appOver(repositoryRoot: string) {
  const changesRepository = new NoesisChangesRepository(
    new NoesisDir(repositoryRoot),
  );
  const designDocsRepository = new NoesisDesignDocsRepository(
    changesRepository,
  );
  const changesService = new ChangesService(
    changesRepository,
    designDocsRepository,
  );
  return createApp({
    searchService: new SearchService(),
    changesService,
    designDocsService: new DesignDocsService(
      designDocsRepository,
      changesService,
    ),
    documentsService: new DocumentsService(
      new NoesisDocumentsRepository(changesRepository),
      changesService,
    ),
  });
}

interface NavigationChange {
  slug: string;
  designDocs: { id: string; name: string }[];
}

describe.each(Object.entries(EXAMPLE_REPOSITORIES))(
  'examples/%s (e2e)',
  (repository, expectedChanges) => {
    const app = appOver(resolve(EXAMPLES, repository));

    it('lists exactly the expected changes', async () => {
      const res = await app.request('/ui/changes/navigation');
      expect(res.status).toBe(200);
      const { changes } = (await res.json()) as { changes: NavigationChange[] };
      expect(changes.map((c) => c.slug).sort()).toEqual(
        Object.keys(expectedChanges).sort(),
      );
      for (const change of changes) {
        expect(change.designDocs).toHaveLength(
          expectedChanges[change.slug]!.designDocs,
        );
      }
    });

    it.each(Object.entries(expectedChanges))(
      'serves every design document and document of %s',
      async (slug, expected) => {
        const navigation = await app.request('/ui/changes/navigation');
        const { changes } = (await navigation.json()) as {
          changes: NavigationChange[];
        };
        const change = changes.find((c) => c.slug === slug);
        expect(change).toBeDefined();

        for (const { id } of change!.designDocs) {
          const res = await app.request(
            `/ui/changes/${slug}/design-docs/${id}`,
          );
          expect(res.status).toBe(200);
          const { document } = (await res.json()) as {
            document: { id: string };
          };
          expect(document.id).toBe(id);
        }

        const documents = await app.request(`/ui/changes/${slug}/documents`);
        expect(documents.status).toBe(200);
        const body = (await documents.json()) as {
          documents: { id: string }[];
        };
        expect(body.documents).toHaveLength(expected.documents);
        for (const { id } of body.documents) {
          const res = await app.request(`/ui/changes/${slug}/documents/${id}`);
          expect(res.status).toBe(200);
        }
      },
    );
  },
);
