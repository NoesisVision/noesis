import { describe, expect, it } from 'bun:test';
import { designDocFixture } from './design-doc.fixture.js';
import type { DesignDocument } from './design-doc.js';
import {
  checkDesignDocument,
  type DesignDocIssueCode,
  isConsistentDesignDocument,
} from './design-doc-integrity.js';
import { elementRef, resolveRef, slotRef } from './design-doc-ref.js';

/**
 * Structured-clone the fixture so a mutation in one case cannot leak into the
 * next, and so the checker is exercised against plain data rather than against
 * objects a test has been careful with.
 */
const broken = (mutate: (document: DesignDocument) => void): DesignDocument => {
  const copy = structuredClone(designDocFixture) as DesignDocument;
  mutate(copy);
  return copy;
};

const codes = (document: DesignDocument): DesignDocIssueCode[] =>
  checkDesignDocument(document).map((issue) => issue.code);

describe('a consistent document', () => {
  it('reports nothing at all for the fixture', () => {
    expect(checkDesignDocument(designDocFixture)).toEqual([]);
    expect(isConsistentDesignDocument(designDocFixture)).toBe(true);
  });

  it('reports nothing for an empty document', () => {
    expect(
      checkDesignDocument({
        ...designDocFixture,
        actors: [],
        boundedContexts: [],
        domainModules: [],
        buildingBlocks: [],
        useCases: [],
        behaviours: [],
      }),
    ).toEqual([]);
  });
});

describe('identity', () => {
  it('rejects a duplicate id, because only one of the pair stays addressable', () => {
    const document = broken((doc) => {
      const [first, second] = doc.actors;
      if (first && second) second.id = first.id;
    });

    const [issue] = checkDesignDocument(document);
    expect(issue?.code).toBe('duplicate-id');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('act-patient');
  });

  it('catches a collision between two different kinds of element', () => {
    // Element refs are a bare id resolved through one index, so uniqueness is
    // document-wide, not per collection.
    const document = broken((doc) => {
      const actor = doc.actors[0];
      if (actor) actor.id = 'uc-book';
    });

    const [issue] = checkDesignDocument(document);
    expect(issue?.code).toBe('duplicate-id');
    expect(issue?.message).toContain('uc-book');
  });

  it('catches an id colliding with the document’s own', () => {
    const document = broken((doc) => {
      const rule = doc.useCases[0]?.rules[0];
      if (rule) rule.id = doc.id;
    });

    expect(codes(document)).toContain('duplicate-id');
  });

  it('catches a rule and a field sharing an id across different owners', () => {
    const document = broken((doc) => {
      const field = doc.useCases[0]?.input.fields[0];
      if (field) field.id = 'rule-hold';
    });

    expect(codes(document)).toEqual(['duplicate-id']);
  });

  it('catches a duplicate acceptance-scenario id across two use cases', () => {
    // Acceptance scenarios are addressed from their own root, so their ids
    // share one namespace document-wide.
    const document = broken((doc) => {
      const [first, second] = doc.useCases;
      const scenario = first?.acceptanceScenarios[0];
      if (second && scenario) {
        second.acceptanceScenarios = [{ ...scenario, title: 'A copy' }];
      }
    });

    expect(codes(document)).toContain('duplicate-id');
  });

  it('rejects an empty id, which nothing can reference', () => {
    const document = broken((doc) => {
      const rule = doc.useCases[0]?.rules[0];
      if (rule) rule.id = '';
    });

    const [issue] = checkDesignDocument(document);
    expect(issue?.code).toBe('invalid-id');
    expect(issue?.message).toContain('use case "Book appointment"');
  });

  it('allows punctuation in an id, now that no grammar parses one', () => {
    for (const id of ['a.b', 'a[b', 'a]b', 'urn:noesis:rule/1']) {
      const document = broken((doc) => {
        const rule = doc.useCases[0]?.rules[0];
        if (rule) rule.id = id;
      });
      expect(codes(document)).toEqual([]);
    }
  });

  it('checks ids on nested lists as well as top-level ones', () => {
    const document = broken((doc) => {
      const fields = doc.useCases[0]?.input.fields;
      const [first, second] = fields ?? [];
      if (first && second) second.id = first.id;
    });

    const [issue] = checkDesignDocument(document);
    expect(issue?.code).toBe('duplicate-id');
    // Identity issues point at the containing list: the offending element's own
    // id is the thing that is broken.
    expect(issue?.ref).toEqual(slotRef('uc-book', 'input', 'fields'));
    expect(issue?.message).toContain('already taken by an input field');
  });
});

describe('references', () => {
  it('catches a use case owned by a block that is not an application service', () => {
    const document = broken((doc) => {
      const useCase = doc.useCases[0];
      if (useCase) useCase.applicationServiceId = 'bb-slot-hold';
    });

    const [issue] = checkDesignDocument(document);
    expect(issue?.code).toBe('wrong-reference-type');
    expect(issue?.message).toContain('entity');
    expect(issue?.ref).toEqual(elementRef('uc-book'));
  });

  it('catches a use case owned by a block that does not exist', () => {
    const document = broken((doc) => {
      const useCase = doc.useCases[0];
      if (useCase) useCase.applicationServiceId = 'svc-nope';
    });

    expect(codes(document)).toContain('unresolved-reference');
  });

  it('catches a pairing where only one side agrees', () => {
    const document = broken((doc) => {
      const behaviour = doc.behaviours[0];
      if (behaviour) behaviour.useCaseId = null;
    });

    // Reported once, from the side that still holds a claim: the behaviour has
    // let go, so it has nothing left to be wrong about.
    const issues = checkDesignDocument(document);
    expect(issues.map((issue) => issue.code)).toEqual(['broken-pairing']);
    expect(issues[0]?.ref).toEqual(elementRef('uc-book'));
    expect(issues[0]?.message).toContain('no use case');
  });

  it('catches a behaviour claiming a use case that names another behaviour', () => {
    const document = broken((doc) => {
      const behaviour = doc.behaviours[1];
      if (behaviour) behaviour.useCaseId = 'uc-book';
    });

    const [issue] = checkDesignDocument(document);
    expect(issue?.code).toBe('broken-pairing');
    expect(issue?.ref).toEqual(elementRef('b-hold-place'));
    expect(issue?.message).toContain('b-book');
  });

  it('catches a behaviour on a building block that is not there', () => {
    const document = broken((doc) => {
      const behaviour = doc.behaviours[1];
      if (behaviour) behaviour.buildingBlockId = 'bb-nope';
    });

    expect(codes(document)).toEqual(['unresolved-reference']);
  });

  it('catches an unknown actor reference', () => {
    const document = broken((doc) => {
      doc.useCases[0]?.actorIds.push('act-nope');
    });

    expect(codes(document)).toEqual(['unresolved-reference']);
  });

  it('warns about the same actor referenced twice', () => {
    const document = broken((doc) => {
      doc.useCases[0]?.actorIds.push('act-patient');
    });

    const [issue] = checkDesignDocument(document);
    expect(issue?.code).toBe('duplicate-actor-reference');
    expect(issue?.severity).toBe('warning');
    expect(isConsistentDesignDocument(document)).toBe(true);
  });

  it('catches a building block whose domain module sits in another context', () => {
    const document = broken((doc) => {
      const module = doc.domainModules[0];
      const context = doc.boundedContexts[0];
      if (module && context) {
        doc.boundedContexts.push({ ...context, id: 'bc-other', name: 'Other' });
        module.boundedContextId = 'bc-other';
      }
    });

    const issues = checkDesignDocument(document);
    expect(
      issues.filter((issue) => issue.code === 'context-mismatch'),
    ).toHaveLength(2);
  });
});

describe('Gherkin structure', () => {
  it('catches an examples row that does not match the header count', () => {
    const document = broken((doc) => {
      const row = doc.useCases[0]?.acceptanceScenarios[1]?.examples?.rows[0];
      if (row) row.cells = ['09:30'];
    });

    const [issue] = checkDesignDocument(document);
    expect(issue?.code).toBe('malformed-examples');
    expect(issue?.message).toContain('1 cells');
    expect(issue?.ref).toEqual(elementRef('row-1'));
  });

  it('warns about an outline with no examples, and a plain scenario with them', () => {
    const noExamples = broken((doc) => {
      const scenario = doc.useCases[0]?.acceptanceScenarios[1];
      if (scenario) scenario.examples = null;
    });
    const strayExamples = broken((doc) => {
      const scenario = doc.useCases[0]?.acceptanceScenarios[1];
      if (scenario) scenario.kind = 'scenario';
    });

    expect(codes(noExamples)).toEqual(['outline-without-examples']);
    expect(codes(strayExamples)).toEqual(['examples-without-outline']);
  });
});

describe('issue shape', () => {
  it('points every issue at a ref that resolves, and names it in words', () => {
    const document = broken((doc) => {
      const useCase = doc.useCases[0];
      if (useCase) useCase.applicationServiceId = 'bb-slot-hold';
      doc.useCases[0]?.actorIds.push('act-nope');
      const row = doc.useCases[0]?.acceptanceScenarios[1]?.examples?.rows[1];
      if (row) row.cells = [];
    });

    const issues = checkDesignDocument(document);
    expect(issues.length).toBeGreaterThan(2);
    for (const issue of issues) {
      // The ref is how a caller navigates; the message is how a person reads
      // it. Neither needs a rendered path.
      expect(resolveRef(document, issue.ref)).toBeDefined();
      expect(issue.message.endsWith('.')).toBe(true);
    }
  });
});
