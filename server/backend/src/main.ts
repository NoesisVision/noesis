// Stays first: the stdout guard has to be in place before any other module is
// evaluated.
import '#backend/boot/process';
import { serve } from '#backend/boot/serve';
import { stop } from '#backend/boot/stop';
import { attach } from '#mcp/attach';
import { version } from '../package.json';

// The composition root, one bin with three commands: `serve` is the
// repository's daemon, which owns the graph and the page; `attach` is one
// session's MCP server on stdio, which calls it; `stop` ends it.

const [command = 'serve', ...flags] = process.argv.slice(2);

switch (command) {
  case 'serve':
    await serve(version, flags.includes('--managed'));
    break;
  case 'attach':
    await attach(version);
    break;
  case 'stop':
    await stop();
    break;
  default:
    console.error('Usage: noesis [serve [--managed] | attach | stop]');
    process.exit(2);
}
