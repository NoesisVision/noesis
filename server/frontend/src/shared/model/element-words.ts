import { modelWordOf } from '#/shared/ui/title-case.ts';

/*
 * What each kind of element is called, once: as a reader meets one and as
 * many. A label — a card's kind, a filter's section, a tooltip's eyebrow —
 * writes it in title case, as the model's other words are (`Building
 * Block`); a sentence writes it in lower case (`Delete the building block`).
 */
const WORDS = {
  module: ['module', 'modules'],
  building_block: ['building block', 'building blocks'],
  behavior: ['behavior', 'behaviors'],
  rule: ['rule', 'rules'],
  scenario: ['scenario', 'scenarios'],
  actor: ['actor', 'actors'],
  manual_process: ['manual process', 'manual processes'],
  need: ['need', 'needs'],
  deployable_unit: ['deployable unit', 'deployable units'],
  library: ['library', 'libraries'],
  layer: ['layer', 'layers'],
  deployment_container: ['deployment container', 'deployment containers'],
} as const;

/** A kind of element the words know. */
export type WordedKind = keyof typeof WORDS;

/** One of a kind, as a label: `Building Block`. */
export const kindLabelOf = (kind: WordedKind): string =>
  modelWordOf(WORDS[kind][0]);

/** Many of a kind, as a label: `Building Blocks`. */
export const kindsLabelOf = (kind: WordedKind): string =>
  modelWordOf(WORDS[kind][1]);

/** One of a kind, inside a sentence: `building block`. */
export const kindInProseOf = (kind: WordedKind): string => WORDS[kind][0];
