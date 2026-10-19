import { createContext, useContext } from 'react';

/**
 * Whether the element is read at a glance — over its card in a diagram,
 * say — rather than in the panel: smaller type, and a rule's description
 * folded until asked for. Given through context, as navigation is, so the
 * aggregators that list the sections never learn about it.
 *
 * Its look is also keyed on `data-glance` on what holds the sections, which
 * their stylesheets read.
 */
export const GlanceReadingContext = createContext(false);

export const useGlanceReading = () => useContext(GlanceReadingContext);
