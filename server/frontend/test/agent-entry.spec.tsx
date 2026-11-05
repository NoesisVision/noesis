import { describe, expect, it } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AgentEntry } from '#backend/app/agent/agent-session.ts';
import { AgentEntryView } from '../src/features/agent/ui/agent-entry';
import { MantineProvider } from '../src/shared/design-system/provider';

const render = (entry: AgentEntry) =>
  renderToStaticMarkup(
    <MantineProvider>
      <QueryClientProvider client={new QueryClient()}>
        <AgentEntryView entry={entry} />
      </QueryClientProvider>
    </MantineProvider>,
  );

const at = '2026-11-05T10:00:00.000Z';

describe('AgentEntryView', () => {
  it('shows what the person sent with the files attached to it', () => {
    const html = render({
      id: '1',
      at,
      kind: 'user',
      text: 'Design it',
      attachments: [{ name: 'spec.md', path: '/scratch/spec.md' }],
    });
    expect(html).toContain('Design it');
    expect(html).toContain('spec.md');
  });

  it('shows a reply still arriving as plain text', () => {
    const html = render({
      id: '2',
      at,
      kind: 'assistant',
      text: 'Reading the **spec**',
      streaming: true,
    });
    expect(html).toContain('Reading the **spec**');
  });

  it('names a tool and what it ran, with its state', () => {
    const html = render({
      id: '3',
      at,
      kind: 'tool',
      toolUseId: 'toolu_1',
      tool: 'mcp__plugin_noesis_noesis__list_changes',
      summary: '',
      state: 'failed',
    });
    expect(html).toContain('list_changes');
    expect(html).not.toContain('mcp__plugin');
    expect(html).toContain('>Failed<');
  });

  it('asks the agent’s question with its options and one for the person’s own answer', () => {
    const html = render({
      id: '4',
      at,
      kind: 'question',
      toolUseId: 'toolu_2',
      questions: [
        {
          question: 'How many designs?',
          header: 'Designs',
          multiSelect: false,
          options: [
            { label: 'One', description: 'A single design' },
            { label: 'Two', description: 'Two to compare' },
          ],
        },
      ],
      answers: null,
    });
    expect(html).toContain('How many designs?');
    expect(html).toContain('A single design');
    expect(html).toContain('Something else');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*?Answer/);
  });

  it('keeps the answer once the question is answered', () => {
    const html = render({
      id: '5',
      at,
      kind: 'question',
      toolUseId: 'toolu_2',
      questions: [
        {
          question: 'How many designs?',
          header: 'Designs',
          multiSelect: false,
          options: [{ label: 'One', description: '' }],
        },
      ],
      answers: { 'How many designs?': 'One' },
    });
    expect(html).toContain('How many designs?');
    expect(html).not.toContain('Answer<');
  });

  it('offers the three answers to a permission, and nothing once decided', () => {
    const open: AgentEntry = {
      id: '6',
      at,
      kind: 'permission',
      toolUseId: 'toolu_3',
      tool: 'Bash',
      summary: 'git log -1',
      detail: 'git log -1\nrm -rf build',
      decision: null,
    };
    const html = render(open);
    expect(html).toContain('rm -rf build');
    expect(html).toContain('Refuse');
    expect(html).toContain('Allow for this session');
    expect(html).toContain('Allow once');
    expect(render({ ...open, decision: 'allow' })).not.toContain('Allow once');
  });

  it('announces a note that reports an error', () => {
    expect(
      render({
        id: '7',
        at,
        kind: 'note',
        text: 'It broke',
        severity: 'error',
      }),
    ).toMatch(/role="alert"[^>]*>It broke/);
    expect(
      render({ id: '8', at, kind: 'note', text: 'Fine', severity: 'info' }),
    ).not.toContain('role="alert"');
  });
});
