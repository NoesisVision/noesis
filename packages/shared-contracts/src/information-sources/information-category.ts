import { z } from 'zod';

// Classification of a unit of source text, shared across source types: an idea
// unit in a conversation and a fragment in a document both carry these labels so
// downstream logic can ignore noise (Irrelevant), locate decisions/arguments,
// and show provenance — independent of where the text came from.
export const InformationCategory = z
  .enum(['Information', 'Position', 'Argument', 'Decision', 'Irrelevant'])
  .describe(
    'What a unit of source text does: Information states a fact; Position states a view someone holds; Argument gives a reason for or against a position; Decision records a choice being made; Irrelevant is noise (greetings, scheduling, asides).',
  );
export type InformationCategory = z.infer<typeof InformationCategory>;
