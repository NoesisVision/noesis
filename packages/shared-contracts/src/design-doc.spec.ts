import { describe, expect, it } from 'bun:test';
import { designDocFixture } from './design-doc.fixture.js';
import { DesignDocumentSchema, DesignedUseCaseSchema } from './design-doc.js';

describe('DesignDocumentSchema', () => {
  const minimal = { id: 'dd-1', name: 'Ordering' };

  it('defaults an empty document to a Draft with every section present', () => {
    const result = DesignDocumentSchema.parse(minimal);

    expect(result.status).toBe('draft');
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.goal).toBe('');
    expect(result.businessContext).toEqual([]);
    expect(result.outcomes).toEqual([]);
    expect(result.scope).toEqual({ inScope: [], outOfScope: [] });
    expect(result.actors).toEqual([]);
    expect(result.boundedContexts).toEqual([]);
    expect(result.domainModules).toEqual([]);
    expect(result.buildingBlocks).toEqual([]);
    expect(result.useCases).toEqual([]);
    expect(result.behaviours).toEqual([]);
    expect(result.baseline).toBeNull();
  });

  it('round-trips the fixture unchanged', () => {
    expect(DesignDocumentSchema.parse(designDocFixture)).toEqual(
      designDocFixture,
    );
  });

  it('reads the document in the agreed order', () => {
    // The reading order is the product (plan §1), so the key order of the
    // schema is not incidental.
    expect(Object.keys(DesignDocumentSchema.shape)).toEqual([
      'id',
      'name',
      'status',
      'date',
      'goal',
      'businessContext',
      'outcomes',
      'scope',
      'actors',
      'boundedContexts',
      'domainModules',
      'buildingBlocks',
      'useCases',
      'behaviours',
      'baseline',
    ]);
  });
});

describe('use cases and behaviours', () => {
  it('pairs a use case with its entry-point behaviour in both directions', () => {
    const useCase = designDocFixture.useCases[0];
    const entryPoint = designDocFixture.behaviours.find(
      (behaviour) => behaviour.id === useCase?.behaviourId,
    );

    expect(entryPoint?.useCaseId).toBe('uc-book');
    // Both name the same application service, in one id space.
    expect(entryPoint?.buildingBlockId).toBe('svc-booking');
    expect(useCase?.applicationServiceId).toBe('svc-booking');
  });

  it('lets a behaviour belong to a building block and no use case', () => {
    const interior = designDocFixture.behaviours[1];

    expect(interior?.buildingBlockId).toBe('bb-slot-hold');
    expect(interior?.useCaseId).toBeNull();
  });

  it('resolves a use case’s application service to a building block of that type', () => {
    const useCase = designDocFixture.useCases[0];
    const service = designDocFixture.buildingBlocks.find(
      (block) => block.id === useCase?.applicationServiceId,
    );

    expect(service?.type).toBe('application_service');
  });

  it('gives building blocks properties, distinct from a use case’s fields', () => {
    const slotHold = designDocFixture.buildingBlocks[1];

    expect(slotHold?.properties.map((property) => property.name)).toEqual([
      'slotId',
      'expiresAt',
    ]);
    expect(slotHold?.properties[0]).toEqual({
      id: 'prop-slot',
      name: 'slotId',
      type: 'TimeSlotId',
      description: '',
      nullable: false,
      collection: false,
    });
  });
});

describe('DesignedUseCaseSchema', () => {
  it('gives a bare use case every section it owns', () => {
    const useCase = DesignedUseCaseSchema.parse({
      id: 'uc-1',
      name: 'Book appointment',
    });

    expect(useCase.type).toBeNull();
    expect(useCase.applicationServiceId).toBeNull();
    expect(useCase.actorIds).toEqual([]);
    expect(useCase.rules).toEqual([]);
    expect(useCase.input).toEqual({ fields: [] });
    expect(useCase.output).toEqual({ summary: '', fields: [] });
    expect(useCase.acceptanceScenarios).toEqual([]);
    expect(useCase.qualityAttributes).toEqual([]);
  });

  it('treats an unscanned use case as having no baseline and no removal intent', () => {
    const useCase = DesignedUseCaseSchema.parse({ id: 'uc-1', name: 'Book' });

    expect(useCase.scanner).toBeNull();
    expect(useCase.baseline).toBeNull();
    expect(useCase.markedForRemoval).toBe(false);
  });

  it('carries one typed field list per direction, labels and all', () => {
    const useCase = DesignedUseCaseSchema.parse({
      id: 'uc-1',
      name: 'Book',
      input: {
        fields: [
          {
            id: 'f-1',
            name: 'slotId',
            label: 'Which slot',
            type: 'TimeSlotId',
          },
        ],
      },
    });

    expect(useCase.input.fields[0]).toEqual({
      id: 'f-1',
      name: 'slotId',
      label: 'Which slot',
      type: 'TimeSlotId',
      note: '',
    });
  });

  it('keeps the full Gherkin hierarchy of an outline', () => {
    const scenario = designDocFixture.useCases[0]?.acceptanceScenarios[1];

    expect(scenario?.kind).toBe('scenarioOutline');
    expect(scenario?.tags).toEqual(['@deposit', '@edge']);
    expect(scenario?.examples?.headers).toEqual(['slot', 'reason']);
    expect(scenario?.examples?.rows).toHaveLength(2);
    expect(scenario?.steps.map((step) => step.keyword)).toEqual([
      'Given',
      'When',
      'Then',
    ]);
  });

  it('rejects a Gherkin keyword outside the vocabulary', () => {
    const result = DesignedUseCaseSchema.safeParse({
      id: 'uc-1',
      name: 'Book',
      acceptanceScenarios: [
        {
          id: 'as-1',
          title: 'Something',
          steps: [{ id: 's-1', keyword: 'Whenever', text: 'nope' }],
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
