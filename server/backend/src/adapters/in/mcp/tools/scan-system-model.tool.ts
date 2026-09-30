import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ScanSystemModelHandler } from '#backend/app/system-model/scan-system-model';
import { SystemModel } from '#backend/app/system-model/system-model';
import { CREATE, defineTool, type ToolRegistration } from '../tool';
import { GET_NEWEST_SYSTEM_MODEL, SCAN_SYSTEM_MODEL } from '../tool-names';
import { success } from '../tool-result';

const inputSchema = z
  .object({})
  .describe(
    'Nothing to pass: the server scans with the scanner it was started with.',
  );

const outputSchema = z
  .object({
    systemModel: SystemModel.pick({ id: true, name: true, scanned_at: true })
      .extend({
        modules: z.int().describe('How many domain modules it holds.'),
        buildingBlocks: z.int().describe('How many building blocks it holds.'),
        behaviours: z.int().describe('How many behaviours it holds.'),
      })
      .describe('The model as stored, counted rather than inlined.'),
  })
  .describe('The system model the scan found.');

export function scanSystemModelTool(
  scanSystemModel: ScanSystemModelHandler,
): ToolRegistration {
  return defineTool(
    SCAN_SYSTEM_MODEL,
    {
      title: 'Scan system model',
      description: `Scans the repository's code and stores the system model found — its modules, building blocks and behaviours — as a new scan, keeping every one before; ${GET_NEWEST_SYSTEM_MODEL} answers with the latest. Design documents are diffs against this model, so scan before designing a change against code that has moved on. Answers with the id the server minted, the model's name, scan time and how many elements of each kind it holds.`,
      inputSchema,
      outputSchema,
      annotations: CREATE,
    },
    async () => scanned(await scanSystemModel.handle()),
  );
}

function scanned(model: SystemModel): CallToolResult {
  const systemModel = {
    id: model.id,
    name: model.name,
    scanned_at: model.scanned_at,
    modules: model.modules.length,
    buildingBlocks: model.buildingBlocks.length,
    behaviours: model.behaviours.length,
  };
  return success(
    `Scanned ${model.name} (${model.id}): ${systemModel.modules} modules, ${systemModel.buildingBlocks} building blocks, ${systemModel.behaviours} behaviours.`,
    { systemModel },
  );
}
