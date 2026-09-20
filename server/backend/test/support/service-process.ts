import type { ChildProcess } from 'node:child_process';
import type { Client } from '@modelcontextprotocol/client';

// A throwaway repository root, so the run writes no `.noesis/` into the
// checkout.
export function serviceEnv(repositoryRoot: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) env[name] = value;
  }
  return { ...env, NOESIS_ROOT: repositoryRoot, NOESIS_OPEN_BROWSER: '0' };
}

// The port is ephemeral, so the URL is read from the service's own stderr
// announcement.
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

export function textOf(
  result: Awaited<ReturnType<Client['callTool']>>,
): string {
  const [content] = result.content as { type: string; text: string }[];
  return content?.text ?? '';
}
