/**
 * A second process for the concurrency spec: writes `rounds` versions of one
 * object as fast as it can. Arguments: directory, key, label, rounds.
 */
import { z } from 'zod';
import { createNoesisStore } from '../../src/platform/files/bun-noesis-store.js';

const [directory, key, label, rounds] = process.argv.slice(2);
if (!directory || !key || !label || !rounds) {
  throw new Error('usage: writer <directory> <key> <label> <rounds>');
}

const store = createNoesisStore({
  directory,
  schema: z.strictObject({
    writer: z.string(),
    round: z.number(),
    padding: z.string(),
  }),
});

for (let round = 0; round < Number(rounds); round++) {
  await store.set(key, { writer: label, round, padding: 'x'.repeat(20_000) });
}
