import {
  DesignDocument,
  type DesignDocumentInput,
} from '#backend/app/design-docs/design-doc.ts';
import example from '../../../../examples/qdoc-java/.noesis/graph/changes/2026-10-02-create-a-qdoc/2026-10-02-create-a-qdoc.design-doc.json';

/*
 * The qdoc example's design, `examples/qdoc-java` `2026-10-02-create-a-qdoc`,
 * read from the example itself rather than copied, so the specs follow the
 * example as it changes. Parsed, so a stored file that no longer fits the
 * contract fails here, by name, rather than as a view reading nonsense.
 */
export const qdocArchitectureFixture: DesignDocumentInput =
  DesignDocument.parse(example);
