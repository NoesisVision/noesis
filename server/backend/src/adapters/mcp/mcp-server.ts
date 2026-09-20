import { McpServer } from '@modelcontextprotocol/server';
import type { ChangesService } from '#backend/app/changes/changes.service';
import type { DocumentsService } from '#backend/app/information-sources/documents.service';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { registerAddDocumentToChange } from './tools/add-document-to-change.tool';
import { registerCreateChange } from './tools/create-change.tool';

export interface McpServerDeps {
  version: string;
  repositoryRoot: string;
  session: SessionDir;
  changesService: ChangesService;
  documentsService: DocumentsService;
}

/**
 * The agent's surface onto the same services the ui calls. Tools stay thin —
 * each registers its schemas and hands one call to one service method
 * (decision D3).
 */
export function createMcpServer(deps: McpServerDeps): McpServer {
  const server = new McpServer(
    { name: 'noesis', title: 'Noesis', version: deps.version },
    {
      capabilities: { tools: { listChanged: true } },
      instructions: instructions(deps),
    },
  );
  registerCreateChange(server, deps.changesService);
  registerAddDocumentToChange(server, deps.documentsService, deps.session);
  return server;
}

/**
 * Nothing process-specific belongs here. On a modern stdio connection the
 * client reads `instructions` from the throwaway sibling process the SDK
 * spawns to probe the protocol era, not from the process that goes on to
 * serve — so a session path named here is already deleted by the time the
 * agent reads it. The live scratch directory is named by each tool's `path`
 * parameter instead, which `tools/list` answers from the serving process.
 */
function instructions(deps: McpServerDeps): string {
  return [
    `Noesis keeps this repository's knowledge graph as files under ${deps.repositoryRoot}/.noesis/. Work is organised into changes, and a change collects the documents that inform it.`,
    `Tools take paths, never content: write a working file under ${deps.repositoryRoot}/.noesis/tmp/ yourself — no tool call needed — and pass its path. Each tool's \`path\` parameter names the directory to write into.`,
  ].join('\n\n');
}
