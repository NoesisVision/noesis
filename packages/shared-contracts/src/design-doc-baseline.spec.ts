import { describe, expect, it } from 'bun:test';
import { designDocFixture } from './design-doc.fixture.js';
import {
  type DesignedActor,
  type DesignedBehaviour,
  type DesignedBoundedContext,
  type DesignedBuildingBlock,
  type DesignedDomainModule,
  type DesignedUseCase,
  DesignedUseCaseSchema,
} from './design-doc.js';
import {
  actorState,
  behaviourState,
  boundedContextState,
  buildingBlockState,
  domainModuleState,
  snapshotUseCase,
  useCaseBaselineDiff,
  useCaseComparable,
  useCaseState,
} from './design-doc-baseline.js';

/** Indexing is checked, and a missing fixture element should fail loudly. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`fixture has no element ${index}`);
  return item;
}

const bookAppointment: DesignedUseCase = at(designDocFixture.useCases, 0);
const sendReminder: DesignedUseCase = at(designDocFixture.useCases, 1);
const scannedActor: DesignedActor = at(designDocFixture.actors, 0);
const unscannedActor: DesignedActor = at(designDocFixture.actors, 1);
const scheduling: DesignedBoundedContext = at(
  designDocFixture.boundedContexts,
  0,
);
const bookingModule: DesignedDomainModule = at(
  designDocFixture.domainModules,
  0,
);
const bookingService: DesignedBuildingBlock = at(
  designDocFixture.buildingBlocks,
  0,
);
const slotHold: DesignedBuildingBlock = at(designDocFixture.buildingBlocks, 1);
const entryBehaviour: DesignedBehaviour = at(designDocFixture.behaviours, 0);
const interiorBehaviour: DesignedBehaviour = at(designDocFixture.behaviours, 1);

const withChange = (patch: Partial<DesignedUseCase>): DesignedUseCase =>
  DesignedUseCaseSchema.parse({ ...bookAppointment, ...patch });

describe('useCaseComparable', () => {
  it('projects only the fields a scanner can populate', () => {
    expect(useCaseComparable(bookAppointment)).toEqual({
      name: 'Book appointment',
      type: 'Command',
      applicationServiceId: 'svc-booking',
      actorIds: ['act-patient', 'act-payments'],
      input: [
        { name: 'patientId', type: 'PatientId' },
        { name: 'slotId', type: 'TimeSlotId' },
        { name: 'paymentIntentId', type: 'PaymentIntentId | null' },
      ],
      output: [{ name: 'appointmentId', type: 'AppointmentId' }],
    });
  });

  it('drops the business wording from the field rows', () => {
    const comparable = useCaseComparable(bookAppointment);

    expect(JSON.stringify(comparable)).not.toContain('Which slot');
    expect(JSON.stringify(comparable)).not.toContain('published availability');
  });

  it('sorts actor references, so reordering them in the document is not a code change', () => {
    expect(
      useCaseComparable(
        withChange({ actorIds: ['act-payments', 'act-patient'] }),
      ),
    ).toEqual(useCaseComparable(bookAppointment));
  });
});

describe('useCaseState', () => {
  it('is New when no scan has seen the use case', () => {
    expect(useCaseState(sendReminder)).toBe('new');
  });

  it('is Modified when a baseline-comparable field differs', () => {
    expect(useCaseState(bookAppointment)).toBe('modified');
  });

  it('is Existing once the comparable projection matches the baseline', () => {
    expect(
      useCaseState(snapshotUseCase(bookAppointment, 'scan-2026-08-15')),
    ).toBe('existing');
  });

  it('is Removed when the design intends to drop an element the baseline has', () => {
    expect(useCaseState(withChange({ markedForRemoval: true }))).toBe(
      'removed',
    );
  });

  const settled = snapshotUseCase(bookAppointment, 'scan-2026-08-15');
  const designOnlyEdits: [string, Partial<DesignedUseCase>][] = [
    ['summary', { summary: 'Rewritten summary.' }],
    ['description', { description: 'Rewritten description.' }],
    ['rules', { rules: [] }],
    ['quality attributes', { qualityAttributes: [] }],
    ['acceptance scenarios', { acceptanceScenarios: [] }],
    [
      'a field label and note',
      {
        input: {
          fields: settled.input.fields.map((field) => ({
            ...field,
            label: 'Reworded',
            note: 'reworded',
          })),
        },
      },
    ],
  ];

  it.each(designOnlyEdits)(
    'stays Existing after an edit to %s (decision 49)',
    (_label, patch) => {
      expect(
        useCaseState(DesignedUseCaseSchema.parse({ ...settled, ...patch })),
      ).toBe('existing');
    },
  );

  const comparableEdits: [string, Partial<DesignedUseCase>][] = [
    ['the name', { name: 'Reserve appointment' }],
    ['the type', { type: 'Query' }],
    ['the owning application service', { applicationServiceId: 'svc-other' }],
    ['actor references', { actorIds: ['act-patient'] }],
    [
      'a field name',
      {
        input: {
          fields: [
            {
              id: 'fld-patient',
              name: 'patient',
              label: 'Who',
              type: 'PatientId',
              note: '',
            },
          ],
        },
      },
    ],
    [
      'a field type',
      {
        output: {
          summary: '',
          fields: [
            {
              id: 'fld-appt',
              name: 'appointmentId',
              label: 'The one',
              type: 'string',
              note: '',
            },
          ],
        },
      },
    ],
  ];

  it.each(comparableEdits)(
    'becomes Modified after an edit to %s',
    (_label, patch) => {
      expect(
        useCaseState(DesignedUseCaseSchema.parse({ ...settled, ...patch })),
      ).toBe('modified');
    },
  );
});

describe('useCaseBaselineDiff', () => {
  it('explains what the source code must change', () => {
    expect(useCaseBaselineDiff(bookAppointment)).toEqual([
      {
        field: 'actor references',
        from: 'act-patient',
        to: 'act-patient, act-payments',
      },
      {
        field: 'input structure',
        from: 'patientId: PatientId, slotId: TimeSlotId',
        to: 'patientId: PatientId, slotId: TimeSlotId, paymentIntentId: PaymentIntentId | null',
      },
    ]);
  });

  it('is empty for an Existing or a New use case', () => {
    expect(useCaseBaselineDiff(snapshotUseCase(bookAppointment, 's'))).toEqual(
      [],
    );
    expect(useCaseBaselineDiff(sendReminder)).toEqual([]);
  });
});

describe('state of the other structure', () => {
  it('derives every element type the same way', () => {
    expect(actorState(scannedActor)).toBe('existing');
    expect(actorState(unscannedActor)).toBe('new');
    expect(boundedContextState(scheduling)).toBe('existing');
    expect(domainModuleState(bookingModule)).toBe('existing');
    expect(buildingBlockState(bookingService)).toBe('existing');
    expect(buildingBlockState(slotHold)).toBe('new');
    expect(behaviourState(entryBehaviour)).toBe('existing');
    expect(behaviourState(interiorBehaviour)).toBe('new');
  });

  it('compares a building block on its property structure', () => {
    const renamedProperty = {
      ...bookingService,
      properties: [{ ...slotHold.properties[0] }],
    } as DesignedBuildingBlock;

    expect(buildingBlockState(renamedProperty)).toBe('modified');
  });

  it('ignores a property description, which no scanner comparison sees', () => {
    const reworded = {
      ...bookingService,
      description: 'Reworded, and not a code change.',
    } as DesignedBuildingBlock;

    expect(buildingBlockState(reworded)).toBe('existing');
  });

  it('does not propagate a new use case up to its service or context', () => {
    // uc-send-reminder is New; nothing containing it is marked.
    expect(useCaseState(sendReminder)).toBe('new');
    expect(buildingBlockState(bookingService)).toBe('existing');
    expect(domainModuleState(bookingModule)).toBe('existing');
    expect(boundedContextState(scheduling)).toBe('existing');
  });
});
