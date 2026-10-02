import { createContext, useContext } from 'react';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';

/**
 * The document the panel reads, for a part deep inside it that names another
 * element and wants to say what that element is. Given through context, as
 * navigation is, so the aggregators between never pass it along.
 */
export const DesignDocumentContext = createContext<DesignDocumentInput | null>(
  null,
);

export const useDesignDocument = () => useContext(DesignDocumentContext);
