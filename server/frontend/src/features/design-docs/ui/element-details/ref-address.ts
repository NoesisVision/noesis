import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';
import { addressOf } from '../../element-id.ts';

/** A type reference by its address, a collection with `[]` after its item. */
export const refAddressOf = (ref: BuildingBlockRefInput): string =>
  typeof ref === 'string'
    ? addressOf(ref)
    : `${refAddressOf(ref.collectionOf)}[]`;
