// The sample repositories under examples/ carry a knowledge graph the service
// must keep reading: every change, design document and document in them is
// served, so a schema change that strands one fails here, not in a demo.
import { describe, expect, it } from 'bun:test';
import { resolve } from 'node:path';
import { createApp } from '#backend/boot/app';
import { createServices } from '#backend/boot/services';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

const EXAMPLES = resolve(__dirname, '../../../../examples');

interface ExpectedChange {
  designDocs: number;
  documents: number;
}

const EXAMPLE_REPOSITORIES: Record<string, Record<string, ExpectedChange>> = {
  'discounts-java': {
    '2026-09-17-weather-based-discount': { designDocs: 1, documents: 2 },
  },
  'discounts-dotnet': {
    '2026-05-08-threshold-activated-discount': { designDocs: 1, documents: 2 },
  },
};

// Read only: the repositories open nothing that is not there, so the checkout
// stays as committed.
function appOver(repositoryRoot: string) {
  return createApp(createServices(new NoesisDir(repositoryRoot)));
}

interface NavigationChange {
  id: string;
  entries: { kind: 'design-doc' | 'document'; id: string }[];
}

describe.each(Object.entries(EXAMPLE_REPOSITORIES))(
  'examples/%s (e2e)',
  (repository, expectedChanges) => {
    const app = appOver(resolve(EXAMPLES, repository));

    it('lists exactly the expected changes', async () => {
      const res = await app.request('/ui/changes/navigation');
      expect(res.status).toBe(200);
      const { changes } = (await res.json()) as { changes: NavigationChange[] };
      expect(changes.map((c) => c.id).sort()).toEqual(
        Object.keys(expectedChanges).sort(),
      );
      for (const change of changes) {
        const expected = expectedChanges[change.id]!;
        const kinds = change.entries.map((entry) => entry.kind);
        expect(kinds.filter((kind) => kind === 'design-doc')).toHaveLength(
          expected.designDocs,
        );
        expect(kinds.filter((kind) => kind === 'document')).toHaveLength(
          expected.documents,
        );
      }
    });

    it.each(Object.entries(expectedChanges))(
      'serves every design document and document of %s',
      async (changeId, expected) => {
        const designDocs = await app.request(
          `/ui/changes/${changeId}/design-docs`,
        );
        expect(designDocs.status).toBe(200);
        const designDocsBody = (await designDocs.json()) as {
          designDocs: { id: string }[];
        };
        expect(designDocsBody.designDocs).toHaveLength(expected.designDocs);
        for (const { id } of designDocsBody.designDocs) {
          const res = await app.request(
            `/ui/changes/${changeId}/design-docs/${id}`,
          );
          expect(res.status).toBe(200);
        }

        const documents = await app.request(
          `/ui/changes/${changeId}/documents`,
        );
        expect(documents.status).toBe(200);
        const documentsBody = (await documents.json()) as {
          documents: { id: string }[];
        };
        expect(documentsBody.documents).toHaveLength(expected.documents);
        for (const { id } of documentsBody.documents) {
          const res = await app.request(
            `/ui/changes/${changeId}/documents/${id}`,
          );
          expect(res.status).toBe(200);
        }
      },
    );
  },
);
