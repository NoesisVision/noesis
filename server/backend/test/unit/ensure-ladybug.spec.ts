import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NativeBinary } from '#backend/platform/native/ensure-ladybug';

let dir: string;
let source: string;
let target: string;

const CONTENT = 'a native module, pretend';

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'noesis-native-'));
  source = join(dir, 'source.node');
  target = join(dir, 'lbugjs.node');
  writeFileSync(source, CONTENT);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const strays = () => readdirSync(dir).filter((name) => name.endsWith('.tmp'));

describe('NativeBinary', () => {
  it('installs the binary when none is in place', () => {
    const binary = NativeBinary.at(target);
    expect(binary.exists).toBe(false);

    binary.installFrom(source);

    expect(readFileSync(target, 'utf8')).toBe(CONTENT);
    expect(binary.isCopyOf(source)).toBe(true);
  });

  it('recognises a complete copy, so a second boot does nothing', () => {
    NativeBinary.at(target).installFrom(source);

    expect(NativeBinary.at(target).isCopyOf(source)).toBe(true);
  });

  // The bug this class exists for: a boot killed mid-copy used to leave a
  // short file that every later boot trusted and loaded.
  it('treats a truncated binary as no copy at all', () => {
    writeFileSync(target, CONTENT.slice(0, 5));

    const binary = NativeBinary.at(target);
    expect(binary.exists).toBe(true);
    expect(binary.isCopyOf(source)).toBe(false);

    binary.installFrom(source);
    expect(readFileSync(target, 'utf8')).toBe(CONTENT);
  });

  it('leaves no staging file behind once the install succeeds', () => {
    NativeBinary.at(target).installFrom(source);

    expect(strays()).toEqual([]);
  });

  it('leaves the installed binary untouched when the copy fails', () => {
    writeFileSync(target, CONTENT);

    expect(() =>
      NativeBinary.at(target).installFrom(join(dir, 'missing.node')),
    ).toThrow();

    expect(readFileSync(target, 'utf8')).toBe(CONTENT);
    expect(strays()).toEqual([]);
  });
});
