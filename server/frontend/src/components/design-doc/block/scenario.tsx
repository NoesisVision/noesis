import type { DesignedScenario } from '@repo/design-doc-blocks';
import { PlusIcon, XIcon } from 'lucide-react';
import {
  withGroup,
  withUseCaseTail,
} from '@/components/design-doc/block/shared';

interface ScenarioRenderProps {
  block: { id: string; props: Record<string, unknown> };
  editor: {
    updateBlock: (
      block: { id: string },
      update: { props: Record<string, string> },
    ) => unknown;
  };
}

function parseScenarioData(props: Record<string, unknown>): DesignedScenario {
  try {
    const raw = JSON.parse(
      String(props.data ?? '{}'),
    ) as Partial<DesignedScenario>;
    return {
      id: '',
      title: raw.title ?? '',
      kind: raw.kind === 'scenarioOutline' ? 'scenarioOutline' : 'scenario',
      tags: raw.tags ?? [],
      background: raw.background ?? [],
      steps: raw.steps ?? [],
      examples: raw.examples ?? null,
    };
  } catch {
    return {
      id: '',
      title: '',
      kind: 'scenario',
      tags: [],
      background: [],
      steps: [],
      examples: null,
    };
  }
}

const newStepId = () => `st-${crypto.randomUUID().slice(0, 8)}`;

/**
 * The scenario block: Gherkin below block granularity, so steps and example
 * rows live in the `data` prop (ids included, decision 51.7) and are edited
 * through this structured form rather than as free text.
 */
export function ScenarioBlock({ block, editor }: ScenarioRenderProps) {
  const scenario = parseScenarioData(block.props);
  const save = (next: DesignedScenario) => {
    editor.updateBlock(block, {
      props: { data: JSON.stringify({ ...next, id: block.id }) },
    });
  };

  const stepRow = (
    step: DesignedScenario['steps'][number],
    list: 'background' | 'steps',
  ) => (
    <div key={step.id} className="flex items-center gap-2">
      <select
        className="w-20 rounded border border-border bg-card px-1 py-0.5 text-right font-semibold text-primary cursor-pointer hover:bg-accent hover:text-sidebar-accent-foreground hover:border-accent focus:outline-none"
        value={step.keyword}
        onChange={(event) =>
          save({
            ...scenario,
            [list]: scenario[list].map((s) =>
              s.id === step.id
                ? { ...s, keyword: event.target.value as typeof s.keyword }
                : s,
            ),
          })
        }
      >
        {['Given', 'When', 'Then', 'And', 'But'].map((keyword) => (
          <option key={keyword}>{keyword}</option>
        ))}
      </select>
      <input
        className="flex-1 rounded border bg-transparent px-1 py-0.5 hover:border-border focus:border-primary focus:outline-none"
        value={step.text}
        onChange={(event) =>
          save({
            ...scenario,
            [list]: scenario[list].map((s) =>
              s.id === step.id ? { ...s, text: event.target.value } : s,
            ),
          })
        }
      />
      <button
        type="button"
        aria-label="Remove step"
        className="rounded p-0.5 text-muted-foreground hover:bg-accent"
        onClick={() =>
          save({
            ...scenario,
            [list]: scenario[list].filter((s) => s.id !== step.id),
          })
        }
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );

  const addStep = (list: 'background' | 'steps') =>
    save({
      ...scenario,
      [list]: [
        ...scenario[list],
        { id: newStepId(), keyword: 'Given' as const, text: '' },
      ],
    });

  return (
    <div
      contentEditable={false}
      className="dd-editable my-1 w-full border border-border p-3 text-sm"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          {scenario.kind === 'scenarioOutline'
            ? 'Scenario outline'
            : 'Scenario'}
        </span>
        <input
          className="flex-1 rounded border bg-transparent px-1 py-0.5 font-medium hover:border-border focus:border-primary focus:outline-none"
          placeholder="Scenario title"
          value={scenario.title}
          onChange={(event) => save({ ...scenario, title: event.target.value })}
        />
      </div>
      {scenario.background.length > 0 && (
        <div className="mt-1">
          <div className="text-[10px] tracking-wider text-muted-foreground uppercase">
            Background
          </div>
          {scenario.background.map((step) => stepRow(step, 'background'))}
        </div>
      )}
      <div className="mt-1 space-y-0.5">
        {scenario.steps.map((step) => stepRow(step, 'steps'))}
      </div>
      <button
        type="button"
        className="mt-1 flex items-center gap-1 rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent cursor-pointer"
        onClick={() => addStep('steps')}
      >
        <PlusIcon className="size-3" /> step
      </button>
      {scenario.examples !== null && (
        <table className="mt-1 border-collapse text-[13px]">
          <thead>
            <tr>
              {scenario.examples.headers.map((header) => (
                <th
                  key={header}
                  className="border border-border bg-secondary px-2 py-0.5 text-left font-medium"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenario.examples.rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={`${row.id}-${scenario.examples?.headers[cellIndex] ?? cellIndex}`}
                    className="border px-1 py-0.5 focus-within:border-b-primary"
                  >
                    <input
                      className="w-24 bg-transparent focus:outline-none"
                      value={cell}
                      onChange={(event) => {
                        const examples = scenario.examples;
                        if (examples === null) return;
                        save({
                          ...scenario,
                          examples: {
                            ...examples,
                            rows: examples.rows.map((r, i) =>
                              i === rowIndex
                                ? {
                                    ...r,
                                    cells: r.cells.map((c, j) =>
                                      j === cellIndex ? event.target.value : c,
                                    ),
                                  }
                                : r,
                            ),
                          },
                        });
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: this module also exports the ScenarioBlock component; scenario is the renderer entry consumed by editor-blocks.tsx.
export const scenario = withUseCaseTail(
  withGroup((props) => <ScenarioBlock {...(props as ScenarioRenderProps)} />),
);
