// Helpers for specs that run the real service as a child process, from
// source or from the built bin, and talk to it over HTTP or MCP.
import type { ChildProcess } from 'node:child_process';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

/**
 * The environment a spec starts the service with: a throwaway repository
 * root so the run writes no `.noesis/` into the checkout, and no browser
 * popping up in a test run.
 */
export function serviceEnv(repositoryRoot: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) env[name] = value;
  }
  return { ...env, NOESIS_ROOT: repositoryRoot, NOESIS_OPEN_BROWSER: '0' };
}

/**
 * The URL the service announces on stderr, without a trailing slash. The
 * port is ephemeral, so this is how a spec finds it, the way a person does.
 */
export function listeningUrl(
  child: ChildProcess,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolveUrl, reject) => {
    let log = '';
    const timer = setTimeout(
      () =>
        reject(new Error(`No listening line within ${timeoutMs}ms:\n${log}`)),
      timeoutMs,
    );
    child.stderr?.on('data', (chunk: Buffer) => {
      log += chunk.toString();
      // Text while developing, a JSON line from the built bin: both carry
      // the URL after "listening on", the JSON one in escaped quotes.
      const match = /listening on \\?"?(http:\/\/[^\s"\\]+)/.exec(log);
      if (match?.[1]) {
        clearTimeout(timer);
        resolveUrl(match[1].replace(/\/$/, ''));
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(
        new Error(`Service exited with ${code} before listening:\n${log}`),
      );
    });
  });
}

/** The text of a tool result's first content block, or empty. */
export function textOf(
  result: Awaited<ReturnType<Client['callTool']>>,
): string {
  const [content] = result.content as { type: string; text: string }[];
  return content?.text ?? '';
}
