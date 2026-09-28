import { McpServer } from '@modelcontextprotocol/server';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import type { CreateChangeHandler } from '#backend/app/changes/create-change';
import type { ListChangesHandler } from '#backend/app/changes/list-changes';
import type { UpdateChangeHandler } from '#backend/app/changes/update-change';
import type { CreateDesignDocInChangeHandler } from '#backend/app/design-docs/create-design-doc-in-change';
import type { UpdateDesignDocInChangeHandler } from '#backend/app/design-docs/update-design-doc-in-change';
import type { CreateDocumentInChangeHandler } from '#backend/app/information-sources/create-document-in-change';
import type { UpdateDocumentInChangeHandler } from '#backend/app/information-sources/update-document-in-change';
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
  createChange: CreateChangeHandler;
  updateChange: UpdateChangeHandler;
  listChanges: ListChangesHandler;
  createDocumentInChange: CreateDocumentInChangeHandler;
  updateDocumentInChange: UpdateDocumentInChangeHandler;
  createDesignDocInChange: CreateDesignDocInChangeHandler;
  updateDesignDocInChange: UpdateDesignDocInChangeHandler;
}

/**
 * The agent's surface onto the same handlers the ui calls. Tools stay thin —
 * each registers its schemas and hands one command to one handler.
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
    createChangeTool(deps.createChange, deps.sessionFiles),
    updateChangeTool(deps.updateChange, deps.sessionFiles),
    listChangesTool(deps.listChanges),
    createDocumentInChangeTool(deps.createDocumentInChange, deps.sessionFiles),
    updateDocumentInChangeTool(deps.updateDocumentInChange, deps.sessionFiles),
    createDesignDocInChangeTool(
      deps.createDesignDocInChange,
      deps.sessionFiles,
    ),
    updateDesignDocInChangeTool(
      deps.updateDesignDocInChange,
      deps.sessionFiles,
    ),
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
