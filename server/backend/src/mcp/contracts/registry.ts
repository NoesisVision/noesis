import { z } from 'zod';
import type { FileContract } from '../../validation/validator.js';
import { designDocumentContract } from './design-document.js';

/**
 * Every file contract the agent can validate against, keyed by the name the
 * `validate` tool takes. tools/generate-references.ts iterates this to emit
 * each plugin's `<key>.schema.json` / `<key>.example.json` (interim, until the
 * migration's R5 ships the `.ts` sources instead).
 */
export const contracts = {
  'design-document': designDocumentContract,
} satisfies Record<string, FileContract>;

export type ContractName = keyof typeof contracts;

export const contractNames = Object.keys(contracts) as [
  ContractName,
  ...ContractName[],
];

/** JSON Schema for a contract — single-sourced here so consumers don't import zod directly. */
export function toJsonSchema(entry: FileContract): Record<string, unknown> {
  return z.toJSONSchema(entry.schema) as Record<string, unknown>;
}
