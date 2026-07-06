// GENERATED from @repo/mcp-contracts — do not edit; run `bun run generate`.
import { z } from 'zod';

// Classification of a unit of source text, shared across source types: an idea
// unit in a conversation and a fragment in a document both carry these labels so
// downstream logic can ignore noise (Irrelevant), locate decisions/arguments,
// and show provenance — independent of where the text came from.
export const InformationCategory = z.enum([
  'Information',
  'Position',
  'Argument',
  'Decision',
  'Irrelevant',
]);
export type InformationCategory = z.infer<typeof InformationCategory>;
