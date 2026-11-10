import { describe, expect, it } from 'bun:test';
import { splitDiagramPlans } from '#backend/app/agent/diagram-plan-fence';

const plan = {
  summary: 'The refund chain.',
  steps: [
    { op: 'clear' },
    {
      op: 'addChain',
      element: 'behavior|sales.Refund.issue',
      reach: 'invokes',
    },
    { op: 'relations', show: ['contains', 'invokes'] },
  ],
};

describe('splitDiagramPlans', () => {
  it('takes the plan out of the fence and keeps the prose', () => {
    const reply = `Here it is.\n\n\`\`\`noesis-diagram\n${JSON.stringify(plan)}\n\`\`\`\n\nI assumed the sales module.`;
    const split = splitDiagramPlans(reply);
    expect(split.plans).toEqual([plan as never]);
    expect(split.text).toBe('Here it is.\n\n\n\nI assumed the sales module.');
    expect(split.problems).toEqual([]);
  });

  it('reports a fence that is not a plan, and leaves other fences alone', () => {
    const reply =
      '```noesis-diagram\n{ "steps": [] }\n```\n```json\n{"a":1}\n```\n```noesis-diagram\nnot json\n```';
    const split = splitDiagramPlans(reply);
    expect(split.plans).toEqual([]);
    expect(split.problems).toHaveLength(2);
    expect(split.problems[1]).toBe('The diagram plan is not JSON.');
    expect(split.text).toContain('```json');
  });

  it('refuses a step that names no element id', () => {
    const bad = { summary: 's', steps: [{ op: 'add', elements: ['Order'] }] };
    const split = splitDiagramPlans(
      `\`\`\`noesis-diagram\n${JSON.stringify(bad)}\n\`\`\``,
    );
    expect(split.plans).toEqual([]);
    expect(split.problems[0]).toContain('does not fit its contract');
  });
});
