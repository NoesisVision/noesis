import { z } from 'zod';
import type { FindSystemModelGraphHandler } from '#backend/app/system-model/find-system-model-graph';
import { SystemModelGraph } from '#backend/app/system-model/system-model-graph';
import { defineTool, READ_ONLY, type ToolRegistration } from '../tool';
import {
  GET_NEWEST_SYSTEM_MODEL,
  GET_SYSTEM_MODEL_GRAPH,
  SCAN_SYSTEM_MODEL,
} from '../tool-names';
import { success } from '../tool-result';

const inputSchema = z
  .object({})
  .describe(
    'Nothing to pass: the answer is the model scanned last, as a graph.',
  );

const outputSchema = z
  .object({
    graph: SystemModelGraph.nullable().describe(
      'The newest model as a graph: every element by id, kind, name, type and container, and the use and call pairs between them. Null when nothing is scanned yet.',
    ),
  })
  .describe('The newest system model, read as a graph.');

export function getSystemModelGraphTool(
  findSystemModelGraph: FindSystemModelGraphHandler,
): ToolRegistration {
  return defineTool(
    GET_SYSTEM_MODEL_GRAPH,
    {
      title: 'Get system model graph',
      description: `Answers with the system model scanned last as a graph: its modules, building blocks and behaviors by id, kind, name, type and what contains each, and the pairs of which block or behavior uses which block and which behavior calls which — all a diagram of the model is drawn from, and small enough to read inline where ${GET_NEWEST_SYSTEM_MODEL} is not. Null when nothing is scanned yet; scan with ${SCAN_SYSTEM_MODEL} first.`,
      inputSchema,
      outputSchema,
      annotations: READ_ONLY,
    },
    async () => {
      const graph = await findSystemModelGraph.handle();
      return success(
        graph === null
          ? `No system model is scanned yet. Scan one with ${SCAN_SYSTEM_MODEL}.`
          : `Graph of ${graph.modelId}, scanned at ${graph.scannedAt}: ${graph.elements.length} elements, ${graph.uses.length} uses, ${graph.invokes.length} calls.`,
        { graph },
      );
    },
  );
}
