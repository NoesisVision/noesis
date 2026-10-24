import type { SystemModelsReader } from '#backend/app/system-model/system-models.repository';
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
 * follows against the newest scan; before the first one, every design is a
 * green field. `before` is the version an update replaces.
 */
export async function assertDesignDocFollowsRules(
  document: DesignDocumentContent,
  writer: DesignDocFieldAuthor,
  systemModels: SystemModelsReader,
  before?: DesignDocumentContent,
): Promise<void> {
  const systemModel = (await systemModels.findNewest()) ?? undefined;
  const violations =
    writer === 'agent'
      ? DesignDocument.validateAgentGenerated(document, systemModel, before)
      : DesignDocument.validateHumanEdited(document, systemModel);
  if (violations.length > 0) throw new InvalidDesignDocError(violations);
}
