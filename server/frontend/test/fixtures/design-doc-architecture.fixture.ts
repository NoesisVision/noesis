import {
  DesignDocument,
  type DesignDocumentInput,
} from '#backend/app/design-docs/design-doc.ts';
import example from './qdoc-create-a-qdoc.design-doc.json';

/*
 * The qdoc example's design, `examples/qdoc-java` `2026-10-02-create-a-qdoc`,
 * as a copy kept with the specs: the example is a document people work on,
 * and editing it must not change what the specs read. Refresh the copy on
 * purpose when the specs should follow it. Parsed, so a copy that no longer
 * fits the contract fails here, by name, rather than as a view reading
 * nonsense.
 */
export const qdocArchitectureFixture: DesignDocumentInput =
  DesignDocument.parse(example);
