import { addressOf } from '../../element-id.ts';

/** A type reference by its address: a block's path, a primitive's name. */
export const refAddressOf = (ref: string): string => addressOf(ref);
