import { describe, expect, it } from 'bun:test';
import { loadServerConfig } from '#backend/platform/config/config';
import { ConfigurationError } from '#backend/platform/config/configuration-error';

describe('server configuration', () => {
  it('starts on a bare environment, leaving the root to the .git walk', () => {
    expect(loadServerConfig({}).root).toBe(undefined);
  });

  it('takes the repository root from the environment', () => {
    expect(loadServerConfig({ NOESIS_ROOT: '/work/repo' }).root).toBe(
      '/work/repo',
    );
  });

  it('opens the browser unless NOESIS_OPEN_BROWSER=0, on an ephemeral port unless PORT is set', () => {
    expect(loadServerConfig({})).toMatchObject({ openBrowser: true, port: 0 });
    expect(
      loadServerConfig({ NOESIS_OPEN_BROWSER: '0', PORT: '3000' }),
    ).toMatchObject({ openBrowser: false, port: 3000 });
    expect(() => loadServerConfig({ PORT: 'many' })).toThrow(
      ConfigurationError,
    );
  });

  it('rejects an empty root rather than silently ignoring it', () => {
    const load = () => loadServerConfig({ NOESIS_ROOT: '' });

    expect(load).toThrow(ConfigurationError);
    expect(load).toThrow('NOESIS_ROOT');
  });

  it('logs at info unless NOESIS_LOG_LEVEL names a LogTape level, and refuses any other', () => {
    expect(loadServerConfig({}).logLevel).toBe('info');
    expect(loadServerConfig({ NOESIS_LOG_LEVEL: 'debug' }).logLevel).toBe(
      'debug',
    );
    const loud = () => loadServerConfig({ NOESIS_LOG_LEVEL: 'loud' });
    expect(loud).toThrow(ConfigurationError);
    expect(loud).toThrow('NOESIS_LOG_LEVEL');
  });
});
