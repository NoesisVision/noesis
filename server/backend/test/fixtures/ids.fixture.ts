import { DesignDocId } from '#backend/app/changes/model/design-doc-id';
import { SourceDocumentId } from '#backend/app/changes/model/source-document-id';

/** The `n`th of a run of UUIDs that sort in the order of `n`. */
const uuid = (n: number) =>
  `00000000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;

export const designDocId = (n: number) => DesignDocId.parse(uuid(n));
export const sourceDocumentId = (n: number) =>
  SourceDocumentId.parse(uuid(0x1000 + n));
