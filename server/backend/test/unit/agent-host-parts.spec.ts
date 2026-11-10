import { describe, expect, it } from 'bun:test';
import { AsyncQueue } from '#backend/adapters/out/agent/async-queue';
import {
  describeToolInput,
  summarizeToolInput,
} from '#backend/adapters/out/agent/tool-summary';

describe('AsyncQueue', () => {
  it('yields what was pushed before and after the reader asked', async () => {
    const queue = new AsyncQueue<number>();
    queue.push(1);
    const iterator = queue[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ value: 1, done: false });
    const pending = iterator.next();
    queue.push(2);
    expect(await pending).toEqual({ value: 2, done: false });
    queue.end();
    expect((await iterator.next()).done).toBe(true);
    queue.push(3);
    expect((await iterator.next()).done).toBe(true);
  });

  it('ends a reader that is waiting', async () => {
    const queue = new AsyncQueue<number>();
    const iterator = queue[Symbol.asyncIterator]();
    const pending = iterator.next();
    queue.end();
    expect((await pending).done).toBe(true);
  });
});

describe('summarizeToolInput', () => {
  it('reads the command, the path or the question the input carries', () => {
    expect(summarizeToolInput({ command: 'git log -1\n' })).toBe('git log -1');
    expect(summarizeToolInput({ file_path: '/a/b.md' })).toBe('/a/b.md');
    expect(summarizeToolInput({ change: '2026-09-17-x' })).toBe('2026-09-17-x');
  });

  it('says nothing for an input with nothing to show', () => {
    expect(summarizeToolInput({})).toBe('');
  });

  it('describes the whole call for an approval, uncut', () => {
    const long = 'x'.repeat(400);
    expect(describeToolInput({ command: `${long}\nrm -rf /` })).toBe(
      `${long}\nrm -rf /`,
    );
    expect(
      describeToolInput({ file_path: '/a.md', content: 'hello', lines: 2 }),
    ).toBe('file_path: /a.md\ncontent: hello\nlines: 2');
  });

  it('cuts a long line short', () => {
    const long = 'x'.repeat(400);
    const summary = summarizeToolInput({ command: long });
    expect(summary).toHaveLength(160);
    expect(summary.endsWith('…')).toBe(true);
  });
});
