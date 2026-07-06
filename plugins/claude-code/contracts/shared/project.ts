// GENERATED from @repo/mcp-contracts — do not edit; run `bun run generate`.
import { z } from 'zod';

export const ProjectIdSchema = z.string().min(1);
export type ProjectId = z.infer<typeof ProjectIdSchema>;

export const ProjectSchema = z.object({
  id: ProjectIdSchema,
  name: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;
