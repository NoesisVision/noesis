// GENERATED from @repo/mcp-contracts — do not edit; run `bun run generate`.
import { z, type ZodType } from 'zod';
import { helloRequestSchema, helloRequestExample } from './hello.js';

export interface ContractEntry {
  /** Zod schema — use for runtime validation (schema.safeParse). */
  schema: ZodType;
  /** Canonical example payload, emitted next to the JSON Schema for skills. */
  example: unknown;
}

/**
 * Every MCP payload contract, keyed by its artifact name.
 * Plugin generators iterate this to emit `<key>.schema.json` / `<key>.example.json`.
 */
export const contracts = {
  'hello-request': {
    schema: helloRequestSchema,
    example: helloRequestExample,
  },
} satisfies Record<string, ContractEntry>;

export type ContractName = keyof typeof contracts;

/** JSON Schema for a contract — single-sourced here so consumers don't import zod directly. */
export function toJsonSchema(entry: ContractEntry): Record<string, unknown> {
  return z.toJSONSchema(entry.schema) as Record<string, unknown>;
}
