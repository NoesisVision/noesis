import { z } from 'zod';
import { DiagramPlan } from '#backend/app/system-model/diagram-plan';

/** The fence an agent answers a diagram request in. */
const DIAGRAM_FENCE = 'noesis-diagram';

const FENCE = new RegExp(
  '```' + DIAGRAM_FENCE + '[^\\n]*\\n([\\s\\S]*?)```',
  'g',
);

export interface SplitReply {
  /** The reply with its fences taken out. */
  text: string;
  plans: DiagramPlan[];
  /** What a fence held that is not a plan, one line each. */
  problems: string[];
}

/**
 * The plans an agent's reply carries, each in a fence of its own, taken out
 * of the prose around them: the page applies the plans and reads the rest.
 */
export function splitDiagramPlans(reply: string): SplitReply {
  const plans: DiagramPlan[] = [];
  const problems: string[] = [];
  const text = reply
    .replace(FENCE, (_match, body: string) => {
      const parsed = parse(body);
      if (parsed.success) plans.push(parsed.data);
      else problems.push(parsed.error);
      return '';
    })
    .trim();
  return { text, plans, problems };
}

function parse(
  body: string,
): { success: true; data: DiagramPlan } | { success: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { success: false, error: 'The diagram plan is not JSON.' };
  }
  const result = DiagramPlan.safeParse(json);
  return result.success
    ? { success: true, data: result.data }
    : {
        success: false,
        error: `The diagram plan does not fit its contract: ${z.prettifyError(result.error).split('\n').slice(0, 3).join(' ')}`,
      };
}
