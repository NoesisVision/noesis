const MAX_LENGTH = 160;

const NAMING_KEYS = [
  'command',
  'file_path',
  'path',
  'pattern',
  'query',
  'url',
  'skill',
  'description',
  'prompt',
  'change',
];

/**
 * One line saying what a tool call does, for the transcript: the command, the
 * path or the question it carries, whichever the tool is about; nothing for
 * a call whose input names no such thing, since the tool's name says it.
 */
export function summarizeToolInput(input: Record<string, unknown>): string {
  const text = firstString(input);
  if (text === null) return '';
  const line = text.split('\n')[0] ?? text;
  return line.length > MAX_LENGTH ? `${line.slice(0, MAX_LENGTH - 1)}…` : line;
}

/**
 * The whole of what a tool call would do, for the person to read before
 * allowing it: the command as it is, or every field of the input. Nothing
 * is cut: an approval covers all of it.
 */
export function describeToolInput(input: Record<string, unknown>): string {
  if (typeof input.command === 'string') return input.command;
  return Object.entries(input)
    .map(([key, value]) => `${key}: ${render(value)}`)
    .join('\n');
}

function firstString(input: Record<string, unknown>): string | null {
  for (const key of NAMING_KEYS) {
    const value = input[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

function render(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}
