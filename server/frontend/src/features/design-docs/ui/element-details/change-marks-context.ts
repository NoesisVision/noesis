import { createContext, useContext } from 'react';

/**
 * Whether what the page reads is a change, whose parts say what it does to
 * them. A model read as it stands is no change: the scan's elements come in
 * as a design that adds them all, and none of that is to be marked.
 */
export const ChangeMarksContext = createContext(true);

export const useChangeMarks = () => useContext(ChangeMarksContext);
