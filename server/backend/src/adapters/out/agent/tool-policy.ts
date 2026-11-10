import type { AgentTask } from '#backend/app/agent/agent-task';

/** How the session names a tool of the plugin's `noesis` server. */
export const NOESIS_TOOL_PREFIX = 'mcp__plugin_noesis_noesis__';

const SESSIONS_DIR = '.noesis/sessions/';

export type ToolVerdict =
  | { allowed: true }
  | { allowed: false; reason: string };

export interface ToolUse {
  tool: string;
  input: Record<string, unknown>;
}

export interface ToolPolicyScope {
  /** The plugin's own files: its skills, contracts and scripts. */
  pluginRoot: string;
  /** The repository the session works in. */
  repositoryRoot: string;
}

const ALLOWED = { allowed: true } as const;

const DIAGRAM_REASON =
  'On the diagram the agent works from the system model alone: call get_system_model_graph, ask the person what is unclear, and answer with a diagram plan. No files, scripts, searches or other skills.';

const DESIGN_REASON =
  "The agent works through Noesis: its tools, the plugin's own skills, contracts and scripts, and the working files under .noesis/sessions/. Nothing else is read or run.";

/**
 * What the session may do, by what the page is about. The agent reaches
 * the knowledge graph only through Noesis's tools; on a diagram it needs
 * nothing else, and on a design document only the plugin's own files, its
 * scripts, the working files and a look at the repository's history. The
 * verdict is a rule, not a prompt: a call outside it is refused with the
 * reason, whatever the permission mode would have said.
 */
export function judgeToolUse(
  task: AgentTask | null,
  use: ToolUse,
  scope: ToolPolicyScope,
): ToolVerdict {
  if (use.tool.startsWith(NOESIS_TOOL_PREFIX)) return ALLOWED;
  if (use.tool === 'AskUserQuestion' || use.tool === 'ToolSearch')
    return ALLOWED;
  if (use.tool === 'Skill') return judgeSkill(use.input);
  if (task?.kind === 'diagram') return refused(DIAGRAM_REASON);
  return judgeDesignUse(use, scope);
}

function judgeSkill(input: Record<string, unknown>): ToolVerdict {
  const { skill } = input;
  return typeof skill === 'string' && skill.startsWith('noesis:')
    ? ALLOWED
    : refused("Only Noesis's own skills are used here.");
}

function judgeDesignUse(use: ToolUse, scope: ToolPolicyScope): ToolVerdict {
  switch (use.tool) {
    case 'Agent':
    case 'TodoWrite':
      return ALLOWED;
    case 'Read':
    case 'Glob':
    case 'Grep':
      return pathOf(use.input) === null ||
        isPluginFile(pathOf(use.input), scope) ||
        isWorkingFile(pathOf(use.input), scope)
        ? ALLOWED
        : refused(DESIGN_REASON);
    case 'Write':
    case 'Edit':
      return isWorkingFile(pathOf(use.input), scope)
        ? ALLOWED
        : refused(DESIGN_REASON);
    case 'Bash':
      return isAllowedCommand(use.input, scope)
        ? ALLOWED
        : refused(DESIGN_REASON);
    default:
      return refused(DESIGN_REASON);
  }
}

function refused(reason: string): ToolVerdict {
  return { allowed: false, reason };
}

/** The path a file tool names, whichever field it uses; null when it names none (Grep over the project). */
function pathOf(input: Record<string, unknown>): string | null {
  for (const key of ['file_path', 'path']) {
    const value = input[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return null;
}

function isPluginFile(path: string | null, scope: ToolPolicyScope): boolean {
  return path !== null && path.startsWith(`${scope.pluginRoot}/`);
}

function isWorkingFile(path: string | null, scope: ToolPolicyScope): boolean {
  if (path === null) return false;
  const absolute = `${scope.repositoryRoot}/${SESSIONS_DIR}`;
  return path.startsWith(absolute) || path.startsWith(SESSIONS_DIR);
}

const GIT_READ = /^(?:rtk )?git (?:log|status|diff)\b/;

/**
 * A command the skills themselves ask for: one of the plugin's scripts, or
 * a read of the repository's history to decide whether to scan again.
 */
function isAllowedCommand(
  input: Record<string, unknown>,
  scope: ToolPolicyScope,
): boolean {
  const { command } = input;
  if (typeof command !== 'string') return false;
  const trimmed = command.trim();
  const script = new RegExp(
    `^(?:rtk )?bun "?${escape(scope.pluginRoot)}/skills/[^;&|]*$`,
  );
  return (
    script.test(trimmed) ||
    trimmed
      .split(/\s*(?:;|&&|\|\|)\s*/)
      .every((part) => GIT_READ.test(part.replace(/\s*2>&1$/, '')))
  );
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
