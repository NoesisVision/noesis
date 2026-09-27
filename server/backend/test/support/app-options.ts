import type { AppOptions } from '#backend/boot/app';

/** A daemon's internal surface with nobody attaching: enough for route specs. */
export function testAppOptions(
  overrides: Partial<AppOptions> = {},
): AppOptions {
  return {
    internal: {
      version: '0.0.0-test',
      instance: 'test-instance',
      attachments: { hold: () => Promise.resolve() },
      url: () => 'http://localhost:0/',
      keepOpen: () => {},
    },
    draining: () => false,
    ...overrides,
  };
}
