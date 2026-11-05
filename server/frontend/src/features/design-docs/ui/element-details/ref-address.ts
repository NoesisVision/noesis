import { addressOf } from '../../element-id.ts';

/** A slot's type by its address: a block's path, a primitive's name. */
export const refAddressOf = (type: string): string => addressOf(type);
