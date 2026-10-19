import { IconFiles } from '@tabler/icons-react';
import type { PageTone } from '#/shared/ui/icon-heading.tsx';

/**
 * The icon a document is drawn with, wherever it is named: the sidebar, a card
 * in the list, the heading of the page that shows one. The domain owns it so a
 * view does not have to pick an icon for material it merely renders.
 */
export const DocumentsIcon = IconFiles;

/** The colour a document's page and its tab are marked with. */
export const DOCUMENTS_TONE = 'teal' satisfies PageTone;
