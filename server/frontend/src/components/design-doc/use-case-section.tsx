import type {
  AcceptanceScenario,
  DocumentModel,
  NumberedUseCase,
  UseCase,
} from '@/components/design-doc/document-model';
import { missingSections } from '@/components/design-doc/document-model';
import { cn } from '@/lib/utils';

type Field = UseCase['input']['fields'][number];
type GherkinStep = AcceptanceScenario['steps'][number];

/** Small uppercase label above a use-case section, prototype's `.label`. */
function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mt-5 mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </div>
  );
}

const TYPE_BADGE_CLASSES: Record<string, string> = {
  Command: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  Query: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  Event:
    'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
};

function TypeBadge({ type }: { type: string | null }) {
  if (type === null) return null;
  return (
    <span
      className={cn(
        'ml-2 inline-block rounded px-1.5 align-middle text-[10.5px] font-semibold tracking-wide uppercase',
        TYPE_BADGE_CLASSES[type] ?? 'bg-secondary text-secondary-foreground',
      )}
    >
      {type}
    </span>
  );
}

/**
 * One typed field list per direction (plan §3.4): the business label first,
 * `name: Type` beside it, so both readerships read the same row.
 */
function FieldTable({ fields }: { fields: Field[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {fields.map((field) => (
          <tr key={field.id} className="border-b border-border last:border-b-0">
            <td className="py-1.5 pr-3 align-top font-medium whitespace-nowrap">
              {field.label || field.name}
            </td>
            <td className="py-1.5 pr-3 align-top font-mono text-xs whitespace-nowrap text-muted-foreground">
              {field.name}: {field.type}
            </td>
            <td className="py-1.5 align-top text-[13.5px] text-muted-foreground">
              {field.note}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GherkinLines({ steps }: { steps: GherkinStep[] }) {
  return (
    <>
      {steps.map((step) => (
        <div key={step.id} className="flex gap-2">
          <span className="min-w-12 text-right font-semibold text-primary">
            {step.keyword}
          </span>
          <span>{step.text}</span>
        </div>
      ))}
    </>
  );
}

function GherkinBlockLabel({ children }: { children: string }) {
  return (
    <div className="mt-2 mb-0.5 text-[11px] tracking-wider text-muted-foreground uppercase first:mt-0">
      {children}
    </div>
  );
}

function Scenario({ scenario }: { scenario: AcceptanceScenario }) {
  const isOutline = scenario.kind === 'scenarioOutline';
  return (
    <div className="border-l-2 border-border py-0.5 pl-3.5">
      <div>
        <span className="font-medium">{scenario.title}</span>
        {isOutline && (
          <span className="ml-2 inline-block rounded bg-secondary px-1.5 align-middle text-[10.5px] font-semibold tracking-wide text-secondary-foreground uppercase">
            outline
          </span>
        )}
        {scenario.tags.length > 0 && (
          <span className="ml-2 font-mono text-[11.5px] text-muted-foreground">
            {scenario.tags.join(' ')}
          </span>
        )}
      </div>
      <div className="mt-1 text-sm">
        {scenario.background.length > 0 && (
          <>
            <GherkinBlockLabel>Background</GherkinBlockLabel>
            <GherkinLines steps={scenario.background} />
          </>
        )}
        {(scenario.background.length > 0 || isOutline) && (
          <GherkinBlockLabel>
            {isOutline ? 'Scenario Outline' : 'Scenario'}
          </GherkinBlockLabel>
        )}
        <GherkinLines steps={scenario.steps} />
        {scenario.examples !== null && (
          <>
            <GherkinBlockLabel>Examples</GherkinBlockLabel>
            <table className="mt-1 border-collapse text-[13px]">
              <thead>
                <tr>
                  {scenario.examples.headers.map((header) => (
                    <th
                      key={header}
                      className="border border-border bg-secondary px-2.5 py-0.5 text-left font-medium"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scenario.examples.rows.map((row) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, cellIndex) => (
                      <td
                        key={`${row.id}-${scenario.examples?.headers[cellIndex] ?? cellIndex}`}
                        className="border border-border px-2.5 py-0.5"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

/** One use case in the reading order: header, meta line, then its sections. */
export function UseCaseSection({
  entry,
  model,
}: {
  entry: NumberedUseCase;
  model: DocumentModel;
}) {
  const { num, useCase } = entry;
  const actors = useCase.actorIds
    .map((id) => model.actorsById.get(id)?.name)
    .filter((name): name is string => name !== undefined);
  const service =
    useCase.applicationServiceId === null
      ? undefined
      : model.servicesById.get(useCase.applicationServiceId);
  const missing = missingSections(useCase);

  return (
    <section>
      <h4
        id={`sec-${useCase.id}`}
        className="mt-7 mb-1.5 scroll-mt-3 text-base font-semibold"
      >
        <span className="mr-2.5 font-normal text-muted-foreground tabular-nums">
          {num}
        </span>
        {useCase.name}
        <TypeBadge type={useCase.type} />
      </h4>

      <div className="mb-3.5 text-[13px] text-muted-foreground">
        <span className="text-secondary-foreground">Actors: </span>
        {actors.length > 0 ? actors.join(', ') : 'none yet'}
        {service !== undefined && (
          <>
            {' · '}
            <span className="text-secondary-foreground">Service: </span>
            {service.name}
          </>
        )}
      </div>

      {useCase.summary !== '' && (
        <p className="my-1.5 text-[17px] leading-relaxed">{useCase.summary}</p>
      )}

      {useCase.description !== '' && (
        <>
          <SectionLabel>Description</SectionLabel>
          <p className="whitespace-pre-wrap">{useCase.description}</p>
        </>
      )}

      {useCase.rules.length > 0 && (
        <>
          <SectionLabel>Rules</SectionLabel>
          <ol className="list-decimal space-y-0.5 pl-5.5 marker:text-[13px] marker:text-muted-foreground marker:tabular-nums">
            {useCase.rules.map((rule) => (
              <li key={rule.id}>{rule.text}</li>
            ))}
          </ol>
        </>
      )}

      {useCase.input.fields.length > 0 && (
        <>
          <SectionLabel>Input</SectionLabel>
          <FieldTable fields={useCase.input.fields} />
        </>
      )}

      {(useCase.output.summary !== '' || useCase.output.fields.length > 0) && (
        <>
          <SectionLabel>Output</SectionLabel>
          {useCase.output.summary !== '' && (
            <p className="mb-2.5">{useCase.output.summary}</p>
          )}
          {useCase.output.fields.length > 0 && (
            <FieldTable fields={useCase.output.fields} />
          )}
        </>
      )}

      {useCase.acceptanceScenarios.length > 0 && (
        <>
          <SectionLabel>Acceptance scenarios</SectionLabel>
          <div className="space-y-3">
            {useCase.acceptanceScenarios.map((scenario) => (
              <Scenario key={scenario.id} scenario={scenario} />
            ))}
          </div>
        </>
      )}

      {useCase.qualityAttributes.length > 0 && (
        <>
          <SectionLabel>Quality attributes</SectionLabel>
          <ul className="list-disc space-y-0.5 pl-5.5 marker:text-muted-foreground">
            {useCase.qualityAttributes.map((attribute) => (
              <li key={attribute.id}>
                <strong className="font-semibold">{attribute.name}: </strong>
                {attribute.text}
              </li>
            ))}
          </ul>
        </>
      )}

      {missing.length > 0 && (
        <p className="mt-4 text-[13px] text-muted-foreground">
          Not written yet: {missing.join(', ')}
        </p>
      )}
    </section>
  );
}
