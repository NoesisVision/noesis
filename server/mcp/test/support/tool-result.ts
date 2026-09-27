import type { Client } from '@modelcontextprotocol/client';

/** The text a tool answered with, as a host that reads only that sees it. */
export function textOf(
  result: Awaited<ReturnType<Client['callTool']>>,
): string {
  const [content] = result.content as { type: string; text: string }[];
  return content?.text ?? '';
}
