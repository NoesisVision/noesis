import type { CallToolResult } from '@modelcontextprotocol/server';

/**
 * Everything a tool can foresee going wrong comes back in-band, as a result
 * the model reads and acts on, never as a protocol error (decision D3).
 */
export function failure(...paragraphs: string[]): CallToolResult {
  return {
    content: [{ type: 'text', text: paragraphs.join('\n\n') }],
    isError: true,
  };
}

/**
 * `structuredContent` is the answer, checked by the SDK against the tool's
 * output schema; the text says the same thing in one line, for hosts and
 * models that read only that.
 */
export function success(
  summary: string,
  structuredContent: Record<string, unknown>,
): CallToolResult {
  return { content: [{ type: 'text', text: summary }], structuredContent };
}
