// Stays first: the stdout guard has to be in place before any other module is
// evaluated.
import '#backend/boot/process';
import { serve } from '#backend/boot/serve';
import { stop } from '#backend/boot/stop';
import { serveInProcess } from '#mcp/in-process';
import { version } from '../package.json';

// The composition root. `serve` runs the repository's daemon, which owns the
// graph and the page, and `stop` ends it; a bare `noesis`, which the plugin
// launches, still serves one session in one process.

const [command, ...flags] = process.argv.slice(2);

switch (command) {
  case undefined:
    await serveInProcess(version);
    break;
  case 'serve':
    await serve(version, flags.includes('--managed'));
    break;
  case 'stop':
    await stop();
    break;
  default:
    console.error('Usage: noesis [serve [--managed] | stop]');
    process.exit(2);
}
