import type { OutlineChange } from '#/shared/ui/model-tree/model-outline.ts';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';

const addressOf = (id: string) => id.slice(id.indexOf('|') + 1);

/** A type reference by its address, a collection with `[]` after its item. */
export const refAddressOf = (ref: BuildingBlockRefInput): string =>
  typeof ref === 'string'
    ? addressOf(ref)
    : `${refAddressOf(ref.collectionOf)}[]`;

export const changedRefAddressOf = <T extends OutlineChange>(
  change: T,
): ((ref: BuildingBlockRefInput) => { change: T; name: string }) => {
  return (ref) => ({
    change,
    name: refAddressOf(ref),
  });
};
