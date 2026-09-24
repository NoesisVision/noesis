// Stays first: the stdout guard has to be in place before any other module is
// evaluated.
import './boot/process';
import { version } from '../package.json';
import { installLifecycle } from './boot/lifecycle';
import { serveMcp } from './boot/mcp';
import { createServices } from './boot/services';
import { UiHost } from './boot/ui';
import { openWorkspace } from './boot/workspace';

// The composition root. Boot is in two halves: the MCP surface starts at once
// and answers the SDK's era probe in milliseconds; the ui comes up only once a
// session is known to be served, or when a person starts the process by hand.

const { config, noesis, session } = await openWorkspace();
const services = createServices(noesis);
const ui = new UiHost({ config, services });
const lifecycle = installLifecycle({ dispose: release });

const mcp = serveMcp({
  version,
  noesis,
  session,
  services,
  onServing: () => ui.start(),
  onStdinEnd: () => void lifecycle.shutdown(),
});

// A terminal on stdin means nobody is speaking MCP — `bun run dev`, or the bin
// started by hand — and the page is the whole point of that run.
if (process.stdin.isTTY) ui.start();

async function release(): Promise<void> {
  await ui.stop();
  await mcp.close();
  await session.dispose();
}
