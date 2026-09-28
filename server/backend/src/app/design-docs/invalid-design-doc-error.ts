import type { DesignDocViolation } from './design-doc';

/** A design document an agent wrote breaks the rules of `DesignDocument.validateAgentGenerated`. */
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
