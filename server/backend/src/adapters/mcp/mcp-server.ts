import { McpServer } from '@modelcontextprotocol/server';
import type { SessionFiles } from '#backend/adapters/mcp/session-files';
import type { ChangesService } from '#backend/app/changes/changes.service';
import type { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import type { DocumentsService } from '#backend/app/information-sources/documents.service';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import type { ToolRegistration } from './tool';
import { createChangeTool } from './tools/create-change.tool';
import { createDesignDocInChangeTool } from './tools/create-design-doc-in-change.tool';
import { createDocumentInChangeTool } from './tools/create-document-in-change.tool';
import { listChangesTool } from './tools/list-changes.tool';
import { updateChangeTool } from './tools/update-change.tool';
import { updateDesignDocInChangeTool } from './tools/update-design-doc-in-change.tool';
import { updateDocumentInChangeTool } from './tools/update-document-in-change.tool';

export interface McpServerDeps {
  version: string;
  noesis: NoesisDir;
  sessionFiles: SessionFiles;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  documentsService: DocumentsService;
}

/**
 * The agent's surface onto the same services the ui calls. Tools stay thin —
 * each registers its schemas and hands one call to one service method.
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
    createChangeTool(deps.changesService, deps.sessionFiles),
    updateChangeTool(deps.changesService, deps.sessionFiles),
    listChangesTool(deps.changesService),
    createDocumentInChangeTool(deps.documentsService, deps.sessionFiles),
    updateDocumentInChangeTool(deps.documentsService, deps.sessionFiles),
    createDesignDocInChangeTool(deps.designDocsService, deps.sessionFiles),
    updateDesignDocInChangeTool(deps.designDocsService, deps.sessionFiles),
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
    `Noesis keeps this repository's knowledge graph as files under ${noesis.path}/. Work is organised into changes: a change collects the documents that inform it and the design documents that describe what it does to the model.`,
    `Tools take paths, never content: write a working file under ${sessionFiles.sessionsRoot}/ yourself — no tool call needed — and pass its path. Each tool's \`path\` parameter names the directory to write into.`,
  ].join('\n\n');
}
