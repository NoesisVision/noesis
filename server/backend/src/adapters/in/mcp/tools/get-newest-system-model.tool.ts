import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { FindNewestSystemModelHandler } from '#backend/app/system-model/find-newest-system-model';
import { SystemModel } from '#backend/app/system-model/system-model';
import { defineTool, READ_ONLY, type ToolRegistration } from '../tool';
import { GET_NEWEST_SYSTEM_MODEL, SCAN_SYSTEM_MODEL } from '../tool-names';
import { success } from '../tool-result';

const inputSchema = z
  .object({})
  .describe('Nothing to pass: the answer is the model scanned last.');

const outputSchema = z
  .object({
    systemModel: SystemModel.nullable().describe(
      'The model scanned last, whole. Null when nothing is scanned yet.',
    ),
  })
  .describe('The newest system model of this repository.');

export function getNewestSystemModelTool(
  findNewestSystemModel: FindNewestSystemModelHandler,
): ToolRegistration {
  return defineTool(
    GET_NEWEST_SYSTEM_MODEL,
    {
      title: 'Get newest system model',
      description: `Answers with the system model scanned last — its modules, building blocks and behaviours, each with the id a design document names it by — or null when nothing is scanned yet. Design documents are diffs against this model, so read it before designing a change; refresh it first with ${SCAN_SYSTEM_MODEL} when the code has moved on.`,
      inputSchema,
      outputSchema,
      annotations: READ_ONLY,
    },
    async () => found(await findNewestSystemModel.handle()),
  );
}

function found(systemModel: SystemModel | null): CallToolResult {
  return success(summary(systemModel), { systemModel });
}

function summary(model: SystemModel | null): string {
  if (model === null) {
    return `No system model is scanned yet. Scan one with ${SCAN_SYSTEM_MODEL}.`;
  }
  return `System model ${model.name} (${model.id}), scanned at ${model.scanned_at}: ${model.modules.length} modules, ${model.buildingBlocks.length} building blocks, ${model.behaviours.length} behaviours.`;
}
