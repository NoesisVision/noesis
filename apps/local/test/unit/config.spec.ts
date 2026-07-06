import { afterEach, describe, expect, it } from 'bun:test';
import { loadConfig } from '../../src/config.js';

const original = process.env.NOESIS_SERVER_URL;

afterEach(() => {
  if (original === undefined) {
    delete process.env.NOESIS_SERVER_URL;
  } else {
    process.env.NOESIS_SERVER_URL = original;
  }
});

describe('loadConfig', () => {
  it('defaults to localhost:3000 when NOESIS_SERVER_URL is unset', () => {
    delete process.env.NOESIS_SERVER_URL;
    expect(loadConfig().serverUrl).toBe('http://localhost:3000');
  });

  it('reads NOESIS_SERVER_URL', () => {
    process.env.NOESIS_SERVER_URL = 'https://noesis.example.com';
    expect(loadConfig().serverUrl).toBe('https://noesis.example.com');
  });

  it('fails fast with a clear message on a garbage URL', () => {
    process.env.NOESIS_SERVER_URL = 'not-a-url';
    expect(() => loadConfig()).toThrow(/NOESIS_SERVER_URL/);
  });
});
