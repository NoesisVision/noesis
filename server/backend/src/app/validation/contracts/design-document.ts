import {
  checkDesignDocument,
  type DesignDocIssue,
} from '#backend/app/design-docs/design-doc-integrity';
import {
  type DesignDocument,
  DesignDocumentSchema,
} from '#backend/app/design-docs/model/design-doc';
import type { ElementRef } from '#backend/app/design-docs/model/design-doc-ref';
import type {
  FileContract,
  ValidationIssue,
} from '#backend/app/validation/validator';

/**
 * The only file contract: a design document has rules a schema cannot
 * express, so `validate` runs a whole-document pass (`check`) where the agent
 * writes. A file whose schema is its whole contract is checked against the
 * schema alone, by the route middleware or by its tool (decision D3).
 */
export const designDocumentContract: FileContract<DesignDocument> = {
  schema: DesignDocumentSchema,
  check: (document) =>
    checkDesignDocument(document)
      .filter((issue) => issue.severity === 'error')
      .map(fromIntegrityIssue),
};

function fromIntegrityIssue(issue: DesignDocIssue): ValidationIssue {
  return { path: refPath(issue.ref), message: issue.message };
}

/** `#<id>` marks an id address, as opposed to a JSON path. */
function refPath(ref: ElementRef): string {
  return ref.kind === 'element'
    ? `#${ref.id}`
    : `#${ref.ownerId}.${ref.path.join('.')}`;
}
