import {
  AstBuilder,
  Errors,
  GherkinClassicTokenMatcher,
  Parser,
} from '@cucumber/gherkin';
import {
  type Background,
  type Examples,
  type GherkinDocument,
  IdGenerator,
  type Rule,
  type Scenario,
  type Step,
  StepKeywordType,
} from '@cucumber/messages';
import { ElementName } from '#backend/app/element-id';
import {
  RuleKind,
  type ScenarioStep,
  type ScenarioStepKind,
  type SourceLocation,
} from '#backend/app/system-model/system-model';

/*
 * A feature file read into the rules and scenarios it states (decision 9 of
 * docs/plans/new-system-model.md): a rule is a `Rule:` with one kind tag, a
 * scenario a `Scenario:` (or `Scenario Outline:`) under it. What the file
 * says that is no rule or scenario of the model is dropped with a
 * diagnostic. Which behavior governs a rule is not said here: the builder
 * binds the `When` steps to step definitions.
 */

/** A feature file as the repository holds it: its path from the repository root and its text. */
export interface FeatureFileSource {
  readonly path: string;
  readonly text: string;
}

export interface FeatureScenario {
  readonly name: ElementName;
  readonly description: string | null;
  /** The steps as written, the feature's and the rule's `Background:` first. */
  readonly steps: readonly ScenarioStep[];
  /**
   * The text of every `When` step, as Cucumber matches it: a scenario
   * outline's placeholders filled from its first example.
   */
  readonly whenSteps: readonly string[];
  readonly source: SourceLocation;
}

export interface FeatureRule {
  readonly name: ElementName;
  readonly kind: RuleKind;
  readonly description: string | null;
  readonly scenarios: readonly FeatureScenario[];
  readonly source: SourceLocation;
}

interface FeatureFileDiagnostic {
  readonly message: string;
  readonly source: SourceLocation;
}

export interface ReadFeatureFile {
  readonly rules: readonly FeatureRule[];
  readonly diagnostics: readonly FeatureFileDiagnostic[];
}

const KIND_TAGS: ReadonlyMap<string, RuleKind> = new Map(
  RuleKind.options.map((kind) => [`@${kind}`, kind]),
);

/** The rules and scenarios of one feature file, in the order the file states them. */
export function readFeatureFile(source: FeatureFileSource): ReadFeatureFile {
  return new FeatureFileReading(source).read();
}

class FeatureFileReading {
  private readonly source: FeatureFileSource;
  private readonly diagnostics: FeatureFileDiagnostic[] = [];

  constructor(source: FeatureFileSource) {
    this.source = source;
  }

  read(): ReadFeatureFile {
    const document = this.parsed();
    const feature = document?.feature;
    if (feature === undefined)
      return { rules: [], diagnostics: this.diagnostics };
    const background = feature.children.flatMap((child) =>
      child.background === undefined ? [] : [child.background],
    );
    const rules: FeatureRule[] = [];
    for (const child of feature.children) {
      if (child.scenario !== undefined) {
        this.drop(
          `scenario "${child.scenario.name}" is under no Rule:, so it illustrates nothing`,
          child.scenario.location.line,
        );
      }
      if (child.rule !== undefined) {
        const rule = this.ruleOf(child.rule, background);
        if (rule !== null) rules.push(rule);
      }
    }
    return { rules, diagnostics: this.diagnostics };
  }

  /** The Gherkin document; null, with a diagnostic, when the file is no Gherkin. */
  private parsed(): GherkinDocument | null {
    const parsed = parseGherkin(this.source.text);
    if (parsed instanceof Error) {
      this.drop(
        `is no Gherkin the parser reads (${parsed.message}); none of its rules is read`,
        1,
      );
      return null;
    }
    return parsed;
  }

  private ruleOf(
    rule: Rule,
    featureBackground: readonly Background[],
  ): FeatureRule | null {
    const line = rule.location.line;
    const name = ElementName.safeParse(rule.name);
    if (!name.success) {
      this.drop(
        `rule "${rule.name}" has a name that is no element name (empty, or with '.' or '|')`,
        line,
      );
      return null;
    }
    const kinds = rule.tags.flatMap(({ name: tag }) => {
      const kind = KIND_TAGS.get(tag);
      return kind === undefined ? [] : [kind];
    });
    const [kind, ...more] = kinds;
    if (kind === undefined || more.length > 0) {
      this.drop(
        `rule "${rule.name}" has ${kind === undefined ? 'no kind tag' : `${kinds.length} kind tags`}; it needs exactly one of ${[...KIND_TAGS.keys()].join(', ')}`,
        line,
      );
      return null;
    }
    const background = [
      ...featureBackground,
      ...rule.children.flatMap((child) =>
        child.background === undefined ? [] : [child.background],
      ),
    ];
    const scenarios = rule.children.flatMap((child) => {
      if (child.scenario === undefined) return [];
      const scenario = this.scenarioOf(child.scenario, background);
      return scenario === null ? [] : [scenario];
    });
    return {
      name: name.data,
      kind,
      description: descriptionOf(rule.description),
      scenarios,
      source: this.at(line),
    };
  }

  private scenarioOf(
    scenario: Scenario,
    background: readonly Background[],
  ): FeatureScenario | null {
    const line = scenario.location.line;
    const name = ElementName.safeParse(scenario.name);
    if (!name.success) {
      this.drop(
        `scenario "${scenario.name}" has a name that is no element name (empty, or with '.' or '|')`,
        line,
      );
      return null;
    }
    const written = [
      ...background.flatMap(({ steps }) => steps),
      ...scenario.steps,
    ];
    const kinds = kindsOf(written);
    if (written.length === 0) {
      this.drop(`scenario "${scenario.name}" has no steps`, line);
      return null;
    }
    const example = firstExampleOf(scenario.examples);
    return {
      name: name.data,
      description: descriptionOf(scenario.description),
      steps: written.map((step, index) => ({
        kind: kinds[index]!,
        text: step.text,
      })),
      whenSteps: written
        .filter((_, index) => kinds[index] === 'when')
        .map((step) => filledIn(step.text, example)),
      source: this.at(line),
    };
  }

  private drop(message: string, line: number): void {
    this.diagnostics.push({
      message: `${this.source.path}: ${message}; dropped`,
      source: this.at(line),
    });
  }

  private at(line: number): SourceLocation {
    return { path: this.source.path, startLine: line, endLine: null };
  }
}

/** The document, or the parser's error: the parser has no way to say a file is no Gherkin but to throw. */
function parseGherkin(text: string): GherkinDocument | Error {
  const parser = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  );
  try {
    return parser.parse(text);
  } catch (error) {
    if (
      error instanceof Errors.CompositeParserException ||
      error instanceof Errors.GherkinException
    ) {
      return error;
    }
    throw error;
  }
}

/** What each step is: `Given`, `When`, `Then`, and `And`, `But` or `*` the kind before them, `given` first. */
function kindsOf(steps: readonly Step[]): ScenarioStepKind[] {
  const kinds: ScenarioStepKind[] = [];
  let current: ScenarioStepKind = 'given';
  for (const step of steps) {
    if (step.keywordType === StepKeywordType.CONTEXT) current = 'given';
    if (step.keywordType === StepKeywordType.ACTION) current = 'when';
    if (step.keywordType === StepKeywordType.OUTCOME) current = 'then';
    kinds.push(current);
  }
  return kinds;
}

/** The first row of an outline's first examples table, by column; empty for a plain scenario. */
function firstExampleOf(examples: readonly Examples[]): Map<string, string> {
  for (const { tableHeader, tableBody } of examples) {
    const [row] = tableBody;
    if (tableHeader === undefined || row === undefined) continue;
    return new Map(
      tableHeader.cells.map((cell, index) => [
        cell.value,
        row.cells[index]?.value ?? '',
      ]),
    );
  }
  return new Map();
}

function filledIn(text: string, example: ReadonlyMap<string, string>): string {
  return text.replace(
    /<([^<>]+)>/g,
    (whole, name: string) => example.get(name) ?? whole,
  );
}

/** The free text under a keyword line, its common indentation taken off; null when there is none. */
function descriptionOf(description: string): string | null {
  const lines = description.split('\n');
  const indent = Math.min(
    ...lines
      .filter((line) => line.trim() !== '')
      .map((line) => line.length - line.trimStart().length),
  );
  const text = lines
    .map((line) => line.slice(Number.isFinite(indent) ? indent : 0).trimEnd())
    .join('\n')
    .trim();
  return text === '' ? null : text;
}
