import { z } from 'zod';

export const InformationCategory = z
  .enum(['Information', 'Position', 'Argument', 'Decision', 'Irrelevant'])
  .describe(
    'What a unit of source text does: Information states a fact; Position states a view someone holds; Argument gives a reason for or against a position; Decision records a choice being made; Irrelevant is noise (greetings, scheduling, asides).',
  );
export type InformationCategory = z.infer<typeof InformationCategory>;
