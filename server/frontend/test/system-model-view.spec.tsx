import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  newestSystemModel,
  type SystemModelSummary,
} from '../src/features/system-model/system-model.api';
import { SystemModelView } from '../src/features/system-model/ui/system-model-view';
import { ApiError } from '../src/shared/api/client';
import { describeFailure } from '../src/shared/api/failure';
import { MantineProvider } from '../src/shared/design-system/provider';

const fetchSpy = spyOn(globalThis, 'fetch');
afterEach(() => fetchSpy.mockReset());
afterAll(() => fetchSpy.mockRestore());

const scanned: SystemModelSummary = {
  id: '01a1366f-2a8d-7606-a494-77768a35eef5' as SystemModelSummary['id'],
  name: 'shop',
  scanned_at: '2026-10-21T08:00:00.000Z',
  modules: 3,
  buildingBlocks: 53,
  behaviours: 70,
};

/** The view with the newest scan already read, so the markup is settled. */
function render(newest: SystemModelSummary | null): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(newestSystemModel.queryKey, newest);
  return renderToStaticMarkup(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <SystemModelView />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

describe('SystemModelView', () => {
  it('offers a Scan button before the first scan, under a second-level heading', () => {
    const html = render(null);

    expect(html).toMatch(/<h2[^>]*>No system model is scanned yet<\/h2>/);
    expect(html).toMatch(/<button[^>]*>.*?Scan.*?<\/button>/);
    expect(html).not.toContain('Scan again');
  });

  it('shows the newest scan counted, with its time machine-readable, and a Scan again button', () => {
    const html = render(scanned);

    expect(html).toContain('shop');
    expect(html).toContain('dateTime="2026-10-21T08:00:00.000Z"');
    expect(html).toContain('3 modules, 53 building blocks, 70 behaviours');
    expect(html).toContain('Scan again');
    expect(html).not.toMatch(/<h[1-6]/);
  });

  it('reads the newest scan from the service', async () => {
    fetchSpy.mockResolvedValueOnce(Response.json({ systemModel: scanned }));
    const queryClient = new QueryClient();

    expect(await queryClient.fetchQuery(newestSystemModel)).toEqual(scanned);
    const [input] = fetchSpy.mock.calls[0] ?? [];
    const url = input instanceof Request ? input.url : String(input);
    expect(url).toEndWith('/ui/system-model');
  });
});

describe('a failed scan', () => {
  it('is described by the reason the scanner gave', () => {
    const failure = describeFailure(
      new ApiError(500, {
        error: 'scan_failed',
        message: 'noesis-config.json names no scanner.',
      }),
    );

    expect(failure.title).toBe('The service failed');
    expect(failure.description).toBe('noesis-config.json names no scanner.');
  });
});
