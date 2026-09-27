import { McpServer } from '@modelcontextprotocol/server';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import type { NoesisApi } from '#mcp/api/noesis-api';
import type { SessionFiles } from '#mcp/session/session-files';
import { addDesignDocToChangeTool } from '#mcp/tools/add-design-doc-to-change.tool';
import { addSourceDocumentToChangeTool } from '#mcp/tools/add-source-document-to-change.tool';
import { createChangeTool } from '#mcp/tools/create-change.tool';
import { listChangesTool } from '#mcp/tools/list-changes.tool';
import { updateChangeTool } from '#mcp/tools/update-change.tool';
import { updateDesignDocInChangeTool } from '#mcp/tools/update-design-doc-in-change.tool';
import { updateSourceDocumentInChangeTool } from '#mcp/tools/update-source-document-in-change.tool';
import type { ToolRegistration } from './tool';

export interface McpServerDeps {
  version: string;
  noesis: NoesisDir;
  sessionFiles: SessionFiles;
  /** The `/ui` surface every tool forwards its call to. */
  api: NoesisApi;
}

/**
 * The agent's surface onto the `/ui` routes the page calls. Tools stay thin —
 * each registers its schemas, reads its working file and forwards one call.
 */
export function createMcpServer(deps: McpServerDeps): McpServer {
  const server = new McpServer(
    { name: 'noesis', title: 'Noesis', version: deps.version },
    {
      // `false` is the truth: the tool list is fixed for the connection's
      // life, so no `notifications/tools/list_changed` ever follows. Left
      // unsaid, the SDK advertises `listChanged: true` for us.
      capabilities: { tools: { listChanged: false } },
      instructions: instructions(deps),
    },
  );
  for (const register of tools(deps)) register(server);
  return server;
}

function tools(deps: McpServerDeps): ToolRegistration[] {
  return [
    createChangeTool(deps.api, deps.sessionFiles),
    updateChangeTool(deps.api, deps.sessionFiles),
    listChangesTool(deps.api),
    addSourceDocumentToChangeTool(deps.api, deps.sessionFiles),
    updateSourceDocumentInChangeTool(deps.api, deps.sessionFiles),
    addDesignDocToChangeTool(deps.api, deps.sessionFiles),
    updateDesignDocInChangeTool(deps.api, deps.sessionFiles),
  ];
}

/**
 * Nothing process-specific belongs here. On a modern stdio connection the
 * client reads `instructions` from the throwaway sibling process the SDK
 * spawns to probe the protocol era, not from the process that goes on to
 * serve — so a session path named here is already deleted by the time the
 * agent reads it. The live scratch directory is named by each tool's `path`
 * parameter instead, which `tools/list` answers from the serving process.
 */
function instructions({ noesis, sessionFiles }: McpServerDeps): string {
  return [
    `Noesis keeps this repository's knowledge graph as files under ${noesis.path}/. Work is organised into changes: a change collects the source documents that inform it and the design documents that describe what it does to the model.`,
    `Tools take paths, never content: write a working file under ${sessionFiles.sessionsRoot}/ yourself — no tool call needed — and pass its path. Each tool's \`path\` parameter names the directory to write into.`,
  ].join('\n\n');
}
