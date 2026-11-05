// Stays first: the stdout guard has to be in place before any other module is
// evaluated.
import './boot/process';
import { version } from '../package.json';
import { bootAgent } from './boot/agent';
import { installLifecycle } from './boot/lifecycle';
import { serveMcp } from './boot/mcp';
import { createServices } from './boot/services';
import { UiHost } from './boot/ui';
import { openWorkspace } from './boot/workspace';

// The composition root. Boot is in two halves: the MCP surface starts at once
// and answers the SDK's era probe in milliseconds; the ui comes up only once a
// session is known to be served, or when a person starts the process by hand.

// A terminal on stdin means nobody is speaking MCP — `bun run dev`, or the bin
// started by hand — and the page is the whole point of that run: it comes up
// at once, with a Claude Code session of its own beside it. Started by an
// agent, the page attaches to that agent's session instead.
const startedByPerson = process.stdin.isTTY === true;

const { config, noesis, session, sessionFiles } = await openWorkspace();
const agent = bootAgent({
  noesis,
  sessionDir: session.path,
  embedded: startedByPerson,
});
const services = createServices(noesis, agent);
const ui = new UiHost({ config, services });
const lifecycle = installLifecycle({ dispose: release });

const mcp = serveMcp({
  version,
  noesis,
  sessionFiles,
  services,
  channel: agent.channel,
  replies: agent.replies,
  onServing: () => ui.start(),
  onStdinEnd: () => void lifecycle.shutdown(),
});

if (startedByPerson) ui.start();

async function release(): Promise<void> {
  await agent.host.stop();
  await ui.stop();
  await mcp.close();
  await session.dispose();
}
