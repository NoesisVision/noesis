import { describe, expect, it } from 'bun:test';
import { parseServerConfig } from '../../src/config/config.js';

describe('server configuration', () => {
  it('starts on a bare environment, leaving the root to the .git walk', () => {
    const result = parseServerConfig({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.root).toBe(undefined);
  });

  it('takes the repository root from the environment', () => {
    const result = parseServerConfig({ NOESIS_ROOT: '/work/repo' });

    expect(result.ok && result.config.root).toBe('/work/repo');
  });

  it('rejects an empty root rather than silently ignoring it', () => {
    const result = parseServerConfig({ NOESIS_ROOT: '' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('NOESIS_ROOT');
  });
});
