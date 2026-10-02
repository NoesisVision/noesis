#!/usr/bin/env bun
// Checks the needs and requirements of Markdown documents against the INCOSE
// rules a machine can see: the block format, the attributes, unique IDs and
// statements, and the words that usually break a rule. The block format and
// the rules are described in ../SKILL.md and ../references/rules.md.
//
// Usage: bun check-requirements.ts [--glossary <glossary.md>]... <document.md>...
// A set of documents that shares one glossary passes it with --glossary; its
// terms count as defined in each document, beside the document's own
// glossary section. Exits 1 when a document has errors; warnings alone exit 0.
import { readFileSync } from 'node:fs';

type Severity = 'error' | 'warning';

interface Finding {
  readonly line: number;
  readonly id: string;
  readonly rule: string;
  readonly severity: Severity;
  readonly message: string;
}

interface Block {
  readonly id: string;
  readonly line: number;
  readonly statement: string;
  readonly attributes: ReadonlyMap<string, string>;
}

interface WordRule {
  readonly rule: string;
  readonly pattern: RegExp;
  readonly message: string;
}

const ID_HEADING = /^#{2,6}\s+((?:[A-Z][A-Z0-9]*-)+\d+)\b/;
const ANY_HEADING = /^(#{1,6})\s+(.*)$/;
const ATTRIBUTE = /^\s*[-*]\s+\*\*([^*:]+):?\*\*:?\s*(.*)$/;
const GLOSSARY_HEADING = /glossary|vocabulary|definitions|terms|acronyms/i;

const REQUIRED_ATTRIBUTES = ['type', 'rationale', 'trace', 'verification'];
const RECOMMENDED_ATTRIBUTES = ['level', 'status'];
const LEVELS = ['business', 'stakeholder', 'system', 'subsystem', 'software'];
const NEED_LEVELS = ['business', 'stakeholder'];
const VERIFICATION_METHODS = /\b(test|analysis|inspection|demonstration)\b/i;
const KNOWN_TYPES =
  /\b(functional|performance|interface|data|security|safety|reliability|availability|usability|maintainability|compliance|constraint|environmental|operational)\b/i;

const words = (list: readonly string[], flags = 'gi'): RegExp =>
  new RegExp(`(?<![\\w-])(?:${list.join('|')})(?![\\w-])`, flags);

const WORD_RULES: readonly WordRule[] = [
  {
    rule: 'R1',
    pattern: words(['should', 'must', 'will', 'may', 'might', 'could', 'can']),
    message:
      'modal other than "shall": a binding requirement uses "shall"; a goal belongs in the goals section',
  },
  {
    rule: 'R2',
    pattern:
      /\bshall\s+be\s+(?!able\b|capable\b|designed\b)\w+(?:ed|en|wn|lt|ept|ung)\b/gi,
    message: 'passive voice: make the responsible entity the subject',
  },
  {
    rule: 'R3',
    pattern:
      /\b(?:user|users|operator|operators|customer|customers|person|people)\s+shall\b/gi,
    message:
      'a person as the subject: state what the specified entity shall do',
  },
  {
    rule: 'R5',
    pattern: words(['a', 'an'], 'g'),
    message:
      'indefinite article: use "the" for a defined entity or "each" for every instance',
  },
  {
    rule: 'R7',
    pattern: words([
      'some',
      'several',
      'many',
      'few',
      'various',
      'adequate(?:ly)?',
      'reasonable',
      'reasonably',
      'sufficient(?:ly)?',
      'suitable',
      'appropriate(?:ly)?',
      'typical(?:ly)?',
      'normal(?:ly)?',
      'usual(?:ly)?',
      'generally',
      'significant(?:ly)?',
      'acceptable',
      'approximately',
      'relevant',
      'proper(?:ly)?',
      'large',
      'small',
    ]),
    message: 'vague term: replace with a number or a defined term',
  },
  {
    rule: 'R8',
    pattern: words([
      'where possible',
      'if possible',
      'as far as possible',
      'as appropriate',
      'as required',
      'as necessary',
      'if necessary',
      'when necessary',
      'if needed',
      'when needed',
      'as applicable',
      'where applicable',
      'if practical',
      'where practicable',
      'to the extent practicable',
    ]),
    message: 'escape clause: it lets the builder decide not to comply',
  },
  {
    rule: 'R9',
    pattern: words([
      'including but not limited to',
      'etc\\.?',
      'and so on',
      'such as',
      'among others',
      'for example',
    ]),
    message: 'open-ended clause: list every item or write one requirement each',
  },
  {
    rule: 'R10',
    pattern: words([
      'be able to',
      'be capable of',
      'have the capability to',
      'have the ability to',
      'be designed to',
    ]),
    message: 'superfluous infinitive: state the action directly',
  },
  {
    rule: 'R16',
    pattern: /\bnot\b|n't\b/g,
    message:
      '"not": state what the entity shall do, or the response to the forbidden event',
  },
  {
    rule: 'R17',
    pattern: /(?<![:/])(?<=\w)\/(?=\w)/g,
    message: 'oblique "/": write "and", "or" or "per"',
  },
  {
    rule: 'R19',
    pattern: words(
      ['and', 'or', 'then', 'unless', 'but', 'as well as', 'otherwise'],
      'g',
    ),
    message:
      'combinator: split into one requirement per thought, or join conditions as [A AND B] / [A OR B] (R15, R28)',
  },
  {
    rule: 'R20',
    pattern: words([
      'in order to',
      'so that',
      'so as to',
      'for the purpose of',
      'with the aim of',
      'with the intent',
    ]),
    message: 'purpose phrase: move the purpose to Rationale',
  },
  {
    rule: 'R21',
    pattern: /[()]/g,
    message:
      'parentheses: write the text into the statement or move it to Rationale',
  },
  {
    rule: 'R24',
    pattern: words([
      'it',
      'its',
      'itself',
      'they',
      'them',
      'their',
      'themselves',
      'this',
      'these',
      'those',
      'he',
      'she',
      'him',
      'her',
      'his',
    ]),
    message: 'pronoun: repeat the noun so the statement stands alone',
  },
  {
    rule: 'R26',
    pattern: /100\s?%|(?<![\w-])(?:always|never|at all times|completely|totally|entirely|absolutely)(?![\w-])/gi,
    message: 'absolute: state a target that can be met and verified',
  },
  {
    rule: 'R32',
    pattern: words(['all', 'any', 'every', 'both']),
    message: 'quantifier: use "each"',
  },
  {
    rule: 'R34',
    pattern: words([
      'fast',
      'faster',
      'quick',
      'quickly',
      'slow',
      'easy',
      'easily',
      'simple',
      'user-friendly',
      'intuitive',
      'efficient(?:ly)?',
      'robust',
      'reliable',
      'reliably',
      'flexible',
      'seamless(?:ly)?',
      'optimal(?:ly)?',
      'minimi[sz]e',
      'maximi[sz]e',
      'state-of-the-art',
    ]),
    message: 'unmeasurable quality: give the measure, the value and the unit',
  },
  {
    rule: 'R35',
    pattern: words([
      'soon',
      'eventually',
      'immediately',
      'instantly',
      'promptly',
      'timely',
      'in time',
      'periodically',
      'regularly',
      'frequently',
      'occasionally',
      'later',
      'prior to',
      'before',
      'after',
      'until',
      'as soon as',
      'real[- ]time',
    ]),
    message:
      'indefinite timing: give a named event and a time bound',
  },
  {
    rule: 'R38',
    pattern:
      /(?<![\w-])(?:e\.g\.|i\.e\.|approx\.|min\.|max\.|w\.r\.t\.|vs\.|no\.)/gi,
    message: 'abbreviation: write it out',
  },
];

// A measured value with a unit, and the words that give it a range or bound.
const MEASURED_VALUE =
  /\b\d+(?:\.\d+)?\s?(?:%|ms|s|sec|seconds?|min|minutes?|h|hours?|days?|B|KiB|MiB|GiB|KB|MB|GB|TB|m|cm|mm|km|kg|g|Hz|kHz|MHz|V|A|W|°C)(?![\w-])/;
const BOUND =
  /±|\+\/-|≤|≥|<|>|\b(?:at least|at most|no more than|no less than|not more than|not less than|up to|within|between|maximum|minimum|or less|or more|exceed)\b/i;

const LOGIC_BRACKETS = /\[[^\]]*\]/g;
const ACRONYM = /\b[A-Z][A-Z0-9]{1,}s?\b/g;
const LOGIC_WORDS = new Set(['AND', 'OR', 'NOT', 'TBD', 'TBR', 'XOR']);

const plain = (markdown: string): string =>
  markdown
    .replaceAll(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replaceAll(/[*_`]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();

const isNeed = (id: string): boolean => /^(?:N|NEED|SN)-/.test(id);

function parse(lines: readonly string[]): {
  blocks: Block[];
  glossary: string;
} {
  const blocks: Block[] = [];
  let glossary = '';
  let glossaryLevel = 0;
  let current:
    | { id: string; line: number; quote: string[]; attributes: Map<string, string> }
    | undefined;
  let lastAttribute: string | undefined;

  const close = (): void => {
    if (current) {
      blocks.push({
        id: current.id,
        line: current.line,
        statement: plain(current.quote.join(' ')),
        attributes: current.attributes,
      });
    }
    current = undefined;
    lastAttribute = undefined;
  };

  for (const [index, line] of lines.entries()) {
    const heading = ANY_HEADING.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      if (glossaryLevel && level <= glossaryLevel) glossaryLevel = 0;
      if (GLOSSARY_HEADING.test(heading[2]!)) glossaryLevel = level;
      close();
      const id = ID_HEADING.exec(line);
      if (id) {
        current = {
          id: id[1]!,
          line: index + 1,
          quote: [],
          attributes: new Map(),
        };
      }
      continue;
    }
    if (glossaryLevel) glossary += `${line}\n`;
    if (!current) continue;
    if (line.startsWith('>')) {
      current.quote.push(line.replace(/^>\s?/, ''));
      continue;
    }
    const attribute = ATTRIBUTE.exec(line);
    if (attribute) {
      lastAttribute = attribute[1]!.trim().toLowerCase();
      current.attributes.set(lastAttribute, attribute[2]!.trim());
    } else if (lastAttribute && /^\s+\S/.test(line)) {
      const value = current.attributes.get(lastAttribute) ?? '';
      current.attributes.set(lastAttribute, `${value} ${line.trim()}`);
    }
  }
  close();
  return { blocks, glossary };
}

function checkStatement(block: Block, glossary: string): Finding[] {
  const findings: Finding[] = [];
  const at = (rule: string, severity: Severity, message: string): void => {
    findings.push({ line: block.line, id: block.id, rule, severity, message });
  };
  const { statement } = block;
  if (!statement) {
    at('R1', 'error', 'no statement: put it in a blockquote under the heading');
    return findings;
  }

  const need = isNeed(block.id);
  if (!need) {
    const shalls = statement.match(/\bshall\b/gi)?.length ?? 0;
    if (shalls === 0) at('R1', 'error', 'no "shall"');
    if (shalls > 1) {
      at('R18', 'error', `${shalls} "shall"s: one requirement per statement`);
    }
  }
  if ((statement.match(/[.!?](?:\s|$)/g)?.length ?? 0) > 1) {
    at('R18', 'warning', 'more than one sentence');
  }

  // Logic brackets and TBD/TBR markers follow the R15 convention.
  const text = statement.replaceAll(LOGIC_BRACKETS, ' ');
  // A condition may introduce an instance with "a"; R5 is about what the
  // entity shall act on, so it is checked after "shall" only.
  const shallAt = text.search(/\bshall\b/i);
  const afterShall = shallAt === -1 ? '' : text.slice(shallAt);
  for (const { rule, pattern, message } of WORD_RULES) {
    if (need && (rule === 'R1' || rule === 'R3')) continue;
    const target = rule === 'R5' ? afterShall : text;
    const hits = [...target.matchAll(pattern)].map(([hit]) =>
      hit.toLowerCase(),
    );
    if (hits.length > 0) {
      at(rule, 'warning', `${message} — "${[...new Set(hits)].join('", "')}"`);
    }
  }

  if (!need && MEASURED_VALUE.test(text) && !BOUND.test(text)) {
    at('R33', 'warning', 'measured value without a tolerance or bound');
  }

  const undefinedAcronyms = [...statement.matchAll(ACRONYM)]
    .map(([acronym]) => acronym.replace(/s$/, ''))
    .filter(
      (acronym) =>
        !LOGIC_WORDS.has(acronym) &&
        !new RegExp(`\\b${acronym}\\b`).test(glossary),
    );
  if (undefinedAcronyms.length > 0) {
    at(
      'R37',
      'warning',
      `acronym not in the glossary — "${[...new Set(undefinedAcronyms)].join('", "')}"`,
    );
  }
  return findings;
}

function checkAttributes(block: Block): Finding[] {
  const findings: Finding[] = [];
  const at = (rule: string, severity: Severity, message: string): void => {
    findings.push({ line: block.line, id: block.id, rule, severity, message });
  };
  const has = (name: string): boolean =>
    Boolean(block.attributes.get(name)?.trim());
  const level = block.attributes.get('level')?.trim().toLowerCase();

  if (isNeed(block.id)) {
    if (!has('level')) at('attributes', 'warning', 'missing level');
    if (level && !NEED_LEVELS.includes(level)) {
      at('C2', 'warning', `need at level "${level}": a need is ${NEED_LEVELS.join(' or ')}`);
    }
    return findings;
  }
  if (level && !LEVELS.includes(level)) {
    at('C2', 'warning', `unknown level "${level}": one of ${LEVELS.join(', ')}`);
  }
  for (const name of REQUIRED_ATTRIBUTES) {
    if (!has(name)) at('attributes', 'error', `missing ${name}`);
  }
  for (const name of RECOMMENDED_ATTRIBUTES) {
    if (!has(name)) at('attributes', 'warning', `missing ${name}`);
  }
  const type = block.attributes.get('type');
  if (type && !KNOWN_TYPES.test(type)) {
    at('R29', 'warning', `unknown type "${type}"`);
  }
  const verification = block.attributes.get('verification');
  if (verification && !VERIFICATION_METHODS.test(verification)) {
    at(
      'C7',
      'error',
      'verification method is none of test, analysis, inspection, demonstration',
    );
  }
  return findings;
}

function checkSet(blocks: readonly Block[]): Finding[] {
  const findings: Finding[] = [];
  const seenIds = new Map<string, Block>();
  const seenStatements = new Map<string, Block>();
  for (const block of blocks) {
    const first = seenIds.get(block.id);
    if (first) {
      findings.push({
        line: block.line,
        id: block.id,
        rule: 'IDs',
        severity: 'error',
        message: `ID used again; first at line ${first.line}`,
      });
    } else {
      seenIds.set(block.id, block);
    }
    const key = block.statement.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ');
    const same = key ? seenStatements.get(key) : undefined;
    if (same) {
      findings.push({
        line: block.line,
        id: block.id,
        rule: 'R30',
        severity: 'error',
        message: `same statement as ${same.id}`,
      });
    } else if (key) {
      seenStatements.set(key, block);
    }
  }

  const traced = new Set(
    blocks
      .filter((block) => !isNeed(block.id))
      .flatMap((block) =>
        [...(block.attributes.get('trace') ?? '').matchAll(/(?:[A-Z][A-Z0-9]*-)+\d+/g)].map(
          ([id]) => id,
        ),
      ),
  );
  for (const block of blocks) {
    if (isNeed(block.id) && !traced.has(block.id)) {
      findings.push({
        line: block.line,
        id: block.id,
        rule: 'C10',
        severity: 'warning',
        message: 'need not traced by any requirement',
      });
    }
  }
  for (const id of traced) {
    if (isNeed(id) && !seenIds.has(id)) {
      const from = blocks.find((block) =>
        block.attributes.get('trace')?.includes(id),
      )!;
      findings.push({
        line: from.line,
        id: from.id,
        rule: 'C1',
        severity: 'error',
        message: `traces to ${id}, which this document does not define`,
      });
    }
  }
  return findings;
}

function check(path: string, sharedGlossary: string): boolean {
  const text = readFileSync(path, 'utf8');
  const { blocks, glossary } = parse(text.split('\n'));
  const findings = [
    ...blocks.flatMap((block) => [
      ...checkStatement(block, `${glossary}\n${sharedGlossary}`),
      ...checkAttributes(block),
    ]),
    ...checkSet(blocks),
  ].toSorted((a, b) => a.line - b.line);

  for (const finding of findings) {
    console.log(
      `${path}:${finding.line} ${finding.id} ${finding.severity} ${finding.rule}: ${finding.message}`,
    );
  }

  const needs = blocks.filter((block) => isNeed(block.id)).length;
  const requirements = blocks.length - needs;
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.length - errors;
  const flagged = new Set(findings.map((f) => f.id)).size;
  const open = new Set(text.match(/\b(?:TBD|TBR)-\d+\b/g) ?? []).size;
  console.log(
    `${path}: ${needs} needs, ${requirements} requirements; ` +
      `${blocks.length - flagged} clean, ${flagged} with findings; ` +
      `${errors} errors, ${warnings} warnings; ${open} open TBD/TBR`,
  );
  if (blocks.length === 0) {
    console.log(
      `${path}: no blocks found — each need or requirement is a heading with its ID, e.g. "### FR-ACC-001 Title"`,
    );
  }
  return errors === 0 && blocks.length > 0;
}

const paths: string[] = [];
const glossaryPaths: string[] = [];
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--glossary') {
    const glossaryPath = args[++index];
    if (!glossaryPath) {
      console.error('--glossary needs a file');
      process.exit(2);
    }
    glossaryPaths.push(glossaryPath);
  } else {
    paths.push(args[index]!);
  }
}
if (paths.length === 0) {
  console.error(
    'usage: bun check-requirements.ts [--glossary <glossary.md>]... <document.md>...',
  );
  process.exit(2);
}
const sharedGlossary = glossaryPaths
  .map((glossaryPath) => readFileSync(glossaryPath, 'utf8'))
  .join('\n');
const results = paths.map((path) => check(path, sharedGlossary));
process.exit(results.every(Boolean) ? 0 : 1);
