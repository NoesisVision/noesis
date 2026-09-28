import {
  DesignDocument,
  type DesignDocumentContent,
  type DesignDocViolation,
} from './design-doc';
import type { DesignDocFieldAuthor } from './design-doc-field';

/** A design document breaks the rules its writer follows. */
export class InvalidDesignDocError extends Error {
  readonly violations: DesignDocViolation[];

  constructor(violations: DesignDocViolation[]) {
    super(
      `The design document breaks its rules:\n${violations
        .map(({ path, reason }) => `- ${path}: ${reason}`)
        .join('\n')}`,
    );
    this.name = 'InvalidDesignDocError';
    this.violations = violations;
  }
}

/**
 * Throws `InvalidDesignDocError` when the document breaks the rules `writer`
 * follows. No system model is scanned yet, so every design is a green field.
 */
export function assertDesignDocFollowsRules(
  document: DesignDocumentContent,
  writer: DesignDocFieldAuthor,
): void {
  const violations =
    writer === 'agent'
      ? DesignDocument.validateAgentGenerated(document)
      : DesignDocument.validateHumanEdited(document);
  if (violations.length > 0) throw new InvalidDesignDocError(violations);
}
