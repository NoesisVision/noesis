import { describe, expect, it } from 'bun:test';
import { parseServerConfig } from '../../src/config/config.js';

describe('server configuration', () => {
  it('defaults the data dir, so a bare environment starts', () => {
    const result = parseServerConfig({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.dataDir).toBe('.data');
  });

  it('takes the data dir from the environment', () => {
    const result = parseServerConfig({ NOESIS_DATA_DIR: '/srv/noesis' });

    expect(result.ok && result.config.dataDir).toBe('/srv/noesis');
  });

  it('rejects an empty data dir rather than silently defaulting it', () => {
    const result = parseServerConfig({ NOESIS_DATA_DIR: '' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('NOESIS_DATA_DIR');
  });
});
