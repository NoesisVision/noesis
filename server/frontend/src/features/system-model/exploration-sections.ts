import { kindsLabelOf } from '#/shared/model/element-words.ts';
import {
  type Exploration,
  type ExploredKind,
  groupOf,
} from './exploration.model.ts';

/*
 * The kinds filter's sections: what may be hidden, a section a kind.
 */

export interface ElementSection {
  /** Its kind, many of it, as a label: `Building Blocks`. */
  title: string;
  groups: { group: string; count: number }[];
}

/** The filter's sections, one a kind, in the order it lists them. */
const SECTIONS = [
  'module',
  'building_block',
  'behavior',
  'actor',
  'manual_process',
  'deployable_unit',
  'library',
  'layer',
  'deployment_container',
] as const satisfies readonly ExploredKind[];

/** The groups a reader may hide, by kind of element, as many as the model holds. */
export function elementSectionsOf(exploration: Exploration): ElementSection[] {
  return SECTIONS.map((kind) => {
    const counts = new Map<string, number>();
    for (const element of exploration.elements)
      if (element.kind === kind)
        counts.set(groupOf(element), (counts.get(groupOf(element)) ?? 0) + 1);
    return {
      title: kindsLabelOf(kind),
      groups: [...counts].map(([group, count]) => ({ group, count })),
    };
  }).filter(({ groups }) => groups.length > 0);
}
