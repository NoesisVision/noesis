import type {
  DiagramPlan,
  DiagramSnapshot,
  DiagramStep,
} from '#backend/app/system-model/diagram-plan.ts';
import {
  chainOf,
  type ExploredElement,
  type Neighbours,
  type RelationKind,
} from './system-model-exploration.ts';

/**
 * A diagram plan, as an agent answers with one, worked out against the
 * model and the diagram as it stands: what goes on, what comes off, which
 * relations are drawn, which way the layout runs, and whether every card is
 * placed afresh. Each step is applied in order, so a later one wins over an
 * earlier one; an id the model does not hold is a problem, not a crash.
 */
export interface ResolvedPlan {
  add: string[];
  remove: string[];
  clear: boolean;
  relations: ReadonlySet<RelationKind> | null;
  direction: 'vertical' | 'horizontal' | null;
  autoPlace: boolean;
  problems: string[];
}

export function resolveDiagramPlan(
  plan: DiagramPlan,
  elements: ReadonlyMap<string, ExploredElement>,
  neighbours: ReadonlyMap<string, Neighbours>,
): ResolvedPlan {
  const on = new Set<string>();
  const off = new Set<string>();
  const problems: string[] = [];
  let clear = false;
  let relations: ReadonlySet<RelationKind> | null = null;
  let direction: ResolvedPlan['direction'] = null;
  let autoPlace = false;

  const put = (id: string) => {
    on.add(id);
    off.delete(id);
  };
  const take = (id: string) => {
    off.add(id);
    on.delete(id);
  };
  const known = (id: string): boolean => {
    if (elements.has(id)) return true;
    problems.push(`The model has no element ${id}.`);
    return false;
  };
  const inside = (id: string): string[] =>
    (neighbours.get(id)?.contains ?? []).flatMap((kid) => [
      kid,
      ...inside(kid),
    ]);

  for (const step of plan.steps) {
    switch (step.op) {
      case 'add':
        for (const id of step.elements) if (known(id)) put(id);
        break;
      case 'addInside':
        if (known(step.element))
          for (const id of [step.element, ...inside(step.element)]) put(id);
        break;
      case 'addNeighbours':
        if (known(step.element)) {
          put(step.element);
          const near = neighbours.get(step.element);
          for (const reach of step.reach)
            for (const id of near?.[reach] ?? []) put(id);
        }
        break;
      case 'addChain':
        if (known(step.element)) {
          put(step.element);
          for (const id of chainOf(
            neighbours,
            elements,
            step.element,
            step.reach,
          ))
            put(id);
        }
        break;
      case 'remove':
        for (const id of step.elements) if (known(id)) take(id);
        break;
      case 'clear':
        clear = true;
        on.clear();
        off.clear();
        break;
      case 'relations':
        relations = new Set(step.show);
        break;
      case 'direction':
        direction = step.direction;
        break;
      case 'autoPlace':
        autoPlace = true;
        break;
    }
  }
  return {
    add: [...on],
    remove: [...off],
    clear,
    relations,
    direction,
    autoPlace,
    problems,
  };
}

/** What applying a plan did, in the words the page says it with. */
export interface PlanOutcome {
  added: number;
  removed: number;
  problems: string[];
}

/** What the page can do with a plan, and what it draws now: the exploration registers it while open. */
export interface DiagramApplier {
  snapshot(): DiagramSnapshot;
  apply(plan: DiagramPlan): PlanOutcome;
}

const REACH_WORDS: Record<string, string> = {
  contains: 'what it contains',
  isPartOf: 'what it is part of',
  uses: 'what it uses',
  usedBy: 'what uses it',
  invokes: 'what it invokes',
  invokedBy: 'what invokes it',
};

const nameOf = (
  id: string,
  elements: ReadonlyMap<string, { name: string }> | null,
): string => elements?.get(id)?.name ?? id.slice(id.indexOf('|') + 1);

/** One step, said as the page would do it. */
export function describeStep(
  step: DiagramStep,
  elements: ReadonlyMap<string, { name: string }> | null,
): string {
  const names = (ids: readonly string[]) =>
    ids.map((id) => nameOf(id, elements)).join(', ');
  switch (step.op) {
    case 'add':
      return `Add ${names(step.elements)}`;
    case 'addInside':
      return `Add ${nameOf(step.element, elements)} with everything inside it`;
    case 'addNeighbours':
      return `Add ${nameOf(step.element, elements)} and ${step.reach.map((reach) => REACH_WORDS[reach]).join(', ')}`;
    case 'addChain':
      return `Add ${nameOf(step.element, elements)} and the chain of ${REACH_WORDS[step.reach]}`;
    case 'remove':
      return `Remove ${names(step.elements)}`;
    case 'clear':
      return 'Clear the diagram';
    case 'relations':
      return step.show.length === 0
        ? 'Draw no relations'
        : `Draw ${step.show.join(', ')}`;
    case 'direction':
      return `Lay out ${step.direction === 'vertical' ? 'top to bottom' : 'left to right'}`;
    case 'autoPlace':
      return 'Place every card afresh';
  }
}
