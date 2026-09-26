import { McpServer } from '@modelcontextprotocol/server';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import type { AddDesignDocToChange } from '#backend/app/changes/add-design-doc-to-change';
import type { AddSourceDocumentToChange } from '#backend/app/changes/add-source-document-to-change';
import type { ChangeWithEntries } from '#backend/app/changes/model/change-entry';
import type {
  ChangeSummary,
  CreateChange,
} from '#backend/app/changes/model/change-snapshot';
import type { DesignDocSummary } from '#backend/app/changes/model/design-doc-summary';
import type { SourceDocumentSummary } from '#backend/app/changes/model/source-document-summary';
import type { UpdateChangeCommand } from '#backend/app/changes/update-change';
import type { UpdateDesignDocInChange } from '#backend/app/changes/update-design-doc-in-change';
import type { UpdateSourceDocumentInChange } from '#backend/app/changes/update-source-document-in-change';
import type { Handler } from '#backend/app/handler';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import type { ToolRegistration } from './tool';
import { addDesignDocToChangeTool } from './tools/add-design-doc-to-change.tool';
import { addSourceDocumentToChangeTool } from './tools/add-source-document-to-change.tool';
import { createChangeTool } from './tools/create-change.tool';
import { listChangesTool } from './tools/list-changes.tool';
import { updateChangeTool } from './tools/update-change.tool';
import { updateDesignDocInChangeTool } from './tools/update-design-doc-in-change.tool';
import { updateSourceDocumentInChangeTool } from './tools/update-source-document-in-change.tool';

export interface McpServerDeps {
  version: string;
  noesis: NoesisDir;
  sessionFiles: SessionFiles;
  createChange: Handler<CreateChange, ChangeSummary>;
  updateChange: Handler<UpdateChangeCommand, ChangeSummary>;
  listChanges: Handler<void, ChangeWithEntries[]>;
  addDesignDocToChange: Handler<AddDesignDocToChange, DesignDocSummary>;
  updateDesignDocInChange: Handler<UpdateDesignDocInChange, DesignDocSummary>;
  addSourceDocumentToChange: Handler<
    AddSourceDocumentToChange,
    SourceDocumentSummary
  >;
  updateSourceDocumentInChange: Handler<
    UpdateSourceDocumentInChange,
    SourceDocumentSummary
  >;
}

/**
 * The agent's surface onto the same handlers the ui calls. Tools stay thin —
 * each registers its schemas and hands one call to one handler.
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
    addSourceDocumentToChangeTool(
      deps.addSourceDocumentToChange,
      deps.sessionFiles,
    ),
    updateSourceDocumentInChangeTool(
      deps.updateSourceDocumentInChange,
      deps.sessionFiles,
    ),
    addDesignDocToChangeTool(deps.addDesignDocToChange, deps.sessionFiles),
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
    `Noesis keeps this repository's knowledge graph as files under ${noesis.path}/. Work is organised into changes: a change collects the source documents that inform it and the design documents that describe what it does to the model.`,
    `Tools take paths, never content: write a working file under ${sessionFiles.sessionsRoot}/ yourself — no tool call needed — and pass its path. Each tool's \`path\` parameter names the directory to write into.`,
  ].join('\n\n');
}
