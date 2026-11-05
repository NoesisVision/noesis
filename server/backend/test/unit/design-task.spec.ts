import { describe, expect, it } from 'bun:test';
import {
  type DesignTask,
  invocationOf,
  promptOf,
  startsTask,
} from '#backend/app/agent/design-task';

const change = '2026-09-17-weather' as DesignTask['change'];
const designDoc = '2026-11-05-sketch' as NonNullable<DesignTask['designDoc']>;

describe('design task', () => {
  it('invokes the plugin skill the page is about', () => {
    expect(invocationOf({ change })).toBe(
      '/noesis:create-design-doc 2026-09-17-weather 1',
    );
    expect(invocationOf({ change, designDoc })).toBe(
      '/noesis:update-design-doc 2026-09-17-weather 2026-11-05-sketch',
    );
  });

  it('starts the skill on a new task, and not on a follow-up in the same place', () => {
    expect(startsTask({ change }, null)).toBe(true);
    expect(startsTask({ change }, { change })).toBe(false);
    expect(startsTask({ change, designDoc }, { change })).toBe(true);
    expect(startsTask(undefined, { change })).toBe(false);
  });

  it('writes the invocation first, then the words, then the files', () => {
    expect(
      promptOf(
        'Keep it small.',
        [{ name: 'a.md', path: '/s/a.md' }],
        { change },
        true,
      ),
    ).toBe(
      '/noesis:create-design-doc 2026-09-17-weather 1\nKeep it small.\n\nAttached files (read them by path):\n- a.md: /s/a.md',
    );
    expect(promptOf('And then?', [], { change }, false)).toBe('And then?');
  });
});
