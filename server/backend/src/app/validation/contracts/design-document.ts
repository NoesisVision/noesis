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
 * The only contract with a whole-document pass (`check`): a design document
 * has rules a schema cannot express, so `validate` runs them where the agent
 * writes. Shapes a schema does cover are checked by the route middleware
 * instead (decision D3).
 */
export const designDocumentContract: FileContract<DesignDocument> = {
  description:
    'A design document: goal, use cases, building blocks and their relations, scoped to one change.',
  schema: DesignDocumentSchema,
  check: (document) =>
    checkDesignDocument(document)
      .filter((issue) => issue.severity === 'error')
      .map(fromIntegrityIssue),
};

const FIXES: Record<DesignDocIssue['code'], string> = {
  'invalid-id': 'Give the element an id in the format the contract describes',
  'duplicate-id': 'Rename one of the elements so every id is unique',
  'unresolved-reference':
    'Point the reference at an element declared in this document, or add the missing element',
  'wrong-reference-type': 'Reference an element of the kind this slot expects',
  'broken-pairing': 'Add the missing half of the pair, or remove the orphan',
  'context-mismatch':
    'Move the element into the context its references belong to',
  'malformed-examples': 'Rewrite the examples in the shape the contract gives',
  'duplicate-actor-reference': 'Reference each actor once',
  'outline-without-examples': 'Add at least one example, or drop the outline',
  'examples-without-outline': 'Add the outline the examples illustrate',
};

function fromIntegrityIssue(issue: DesignDocIssue): ValidationIssue {
  return {
    path: refPath(issue.ref),
    expected: `no ${issue.code.replaceAll('-', ' ')}`,
    found: issue.message,
    fix: FIXES[issue.code],
  };
}

/** `#<id>` marks an id address, as opposed to a JSON path. */
function refPath(ref: ElementRef): string {
  return ref.kind === 'element'
    ? `#${ref.id}`
    : `#${ref.ownerId}.${ref.path.join('.')}`;
}
