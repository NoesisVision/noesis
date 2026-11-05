import { z } from 'zod';
import { ElementId } from '#backend/app/element-id';

/**
 * The deterministic way a diagram of the system model is changed: a plan is
 * a list of steps the page applies in order, each naming elements by the ids
 * the scan gave them. An agent answers a request for a diagram with one, so
 * what it does to the diagram is exactly what the steps say, and nothing
 * else.
 */

/** The relations the diagram draws: containment as cards inside cards, use and calls as edges. */
const DiagramRelation = z.enum(['contains', 'isPartOf', 'uses', 'invokes']);

/** The ways one element reaches others, each read from its own side. */
const DiagramReach = z.enum([
  'contains',
  'isPartOf',
  'uses',
  'usedBy',
  'invokes',
  'invokedBy',
]);

const DiagramDirection = z.enum(['vertical', 'horizontal']);

const elements = z
  .array(ElementId)
  .min(1)
  .describe('Elements by id, as the system model names them.');

export const DiagramStep = z.discriminatedUnion('op', [
  z
    .object({ op: z.literal('add'), elements })
    .describe('Puts these elements on the diagram.'),
  z
    .object({ op: z.literal('addInside'), element: ElementId })
    .describe(
      'Puts this element on the diagram with everything the model holds inside it, all the way down.',
    ),
  z
    .object({
      op: z.literal('addNeighbours'),
      element: ElementId,
      reach: z.array(DiagramReach).min(1),
    })
    .describe(
      'Puts this element on the diagram with the elements it reaches one step away, each way named: what it contains, is part of, uses, is used by, invokes, is invoked by.',
    ),
  z
    .object({
      op: z.literal('addChain'),
      element: ElementId,
      reach: z.enum(['uses', 'usedBy', 'invokes', 'invokedBy']),
    })
    .describe(
      'Puts this element on the diagram with everything it reaches that way, step after step, up to the next element of its own type.',
    ),
  z
    .object({ op: z.literal('remove'), elements })
    .describe(
      'Takes these elements off the diagram, with what is drawn inside them.',
    ),
  z
    .object({ op: z.literal('clear') })
    .describe('Takes everything off the diagram.'),
  z
    .object({ op: z.literal('relations'), show: z.array(DiagramRelation) })
    .describe('Draws exactly these relations, and no other.'),
  z
    .object({ op: z.literal('direction'), direction: DiagramDirection })
    .describe('Which way the layout runs.'),
  z
    .object({ op: z.literal('autoPlace') })
    .describe('Places every card afresh.'),
]);
export type DiagramStep = z.infer<typeof DiagramStep>;

export const DiagramPlan = z
  .object({
    summary: z
      .string()
      .describe(
        'One line on what the diagram shows once the steps are applied.',
      ),
    steps: z.array(DiagramStep).min(1),
  })
  .describe(
    'The steps that turn the diagram as it stands into the one asked for.',
  );
export type DiagramPlan = z.infer<typeof DiagramPlan>;

/** The diagram as it stands, as a message tells the agent. */
export const DiagramSnapshot = z.object({
  /** The elements drawn, by id. */
  drawn: z.array(z.string()),
  relations: z.array(DiagramRelation),
});
export type DiagramSnapshot = z.infer<typeof DiagramSnapshot>;
