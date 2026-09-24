import { z } from 'zod';
import type { ChangeId } from '#backend/app/changes/change-id';
import type {
  Added,
  ChangesService,
} from '#backend/app/changes/changes.service';
import { Serial } from '#backend/app/serial';
import type { DesignDocument } from './design-doc';
import { DesignDocId } from './design-doc-id';
import type { DesignDocsRepository } from './design-docs.repository';

/** What callers get back: plain data, so every adapter can send it as is. */
export const DesignDocSummarySchema = z.object({
  id: DesignDocId,
  name: z.string().describe('The design document name, as stored.'),
  implemented: z
    .boolean()
    .describe('Whether the design is marked as implemented.'),
});
export type DesignDocSummary = z.infer<typeof DesignDocSummarySchema>;

export interface DesignDocDetail {
  summary: DesignDocSummary;
  document: DesignDocument;
}

/** Callers validate before calling in; the id comes with the document. */
export class DesignDocsService {
  private readonly docs: DesignDocsRepository;
  private readonly changesService: ChangesService;
  private readonly writes = new Serial();

  constructor(docs: DesignDocsRepository, changesService: ChangesService) {
    this.docs = docs;
    this.changesService = changesService;
  }

  /**
   * Creates the design document, or updates it when its id is already in the
   * change. The lookup and the write run as one step, so parallel adds agree
   * on which of them created it.
   */
  add(
    change: ChangeId,
    document: DesignDocument,
  ): Promise<Added<DesignDocSummary>> {
    return this.writes.run(async () => {
      await this.changesService.assertExists(change);
      const created = (await this.docs.get(change, document.id)) === null;
      await this.docs.save(change, document);
      return { value: summarize(document), created };
    });
  }

  /** Oldest first: the id starts with the creation date. */
  async list(change: ChangeId): Promise<DesignDocSummary[]> {
    await this.changesService.assertExists(change);
    return (await this.docs.list(change)).map(summarize);
  }

  async findById(
    change: ChangeId,
    id: DesignDocId,
  ): Promise<DesignDocDetail | null> {
    await this.changesService.assertExists(change);
    const document = await this.docs.get(change, id);
    if (document === null) return null;
    return { summary: summarize(document), document };
  }
}

function summarize({
  id,
  name,
  implemented,
}: DesignDocument): DesignDocSummary {
  return { id, name: name.value, implemented };
}
