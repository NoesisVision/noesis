import { type DesignDocument, DesignDocumentSchema } from './design-doc.js';

/*
 * A small but structurally complete design document, used by the design-doc
 * specs. Trimmed from the appointment-booking sample the prototypes render
 * (docs/work/features/design-doc/prototypes/sample-data.js), keeping one of
 * every shape: a plain scenario and an outline with examples, a paired
 * entry-point behaviour and an interior one, human and agent authorship.
 */
export const designDocFixture: DesignDocument = DesignDocumentSchema.parse({
  id: 'doc-appointments',
  name: 'Appointment booking',
  status: 'draft',
  date: '2026-08-14',
  goal: 'Let patients book, move and cancel clinic appointments themselves, and cut the no-show rate to under 5%.',
  businessContext: [
    {
      id: 'ctxp-1',
      text: 'The clinic network runs 12 sites and about 4,000 appointments a week.',
    },
    {
      id: 'ctxp-2',
      text: 'Roughly one in seven booked slots is never used, and is discovered empty only when the patient fails to arrive.',
    },
  ],
  outcomes: [
    {
      id: 'out-1',
      text: 'No-show rate below 5% within two quarters of launch.',
      measure: 'unused booked slots ÷ booked slots, weekly',
    },
  ],
  scope: {
    inScope: [
      {
        id: 'sc-in-1',
        text: 'Self-service booking, rescheduling and cancellation.',
      },
      { id: 'sc-in-2', text: 'Confirmation and reminder messages over SMS.' },
    ],
    outOfScope: [{ id: 'sc-out-1', text: 'Clinician rota planning.' }],
  },
  actors: [
    {
      id: 'act-patient',
      name: 'Patient',
      kind: 'human',
      description: 'Books, reschedules and cancels their own appointments.',
    },
    {
      id: 'act-payments',
      name: 'Payment provider',
      kind: 'system',
      description:
        'Authorises and captures the deposit that secures a booking.',
    },
  ],
  boundedContexts: [{ id: 'bc-scheduling', name: 'Scheduling' }],
  domainModules: [
    { id: 'dm-booking', name: 'Booking', boundedContextId: 'bc-scheduling' },
  ],
  buildingBlocks: [
    {
      id: 'svc-booking',
      name: 'BookingService',
      type: 'application_service',
      boundedContextId: 'bc-scheduling',
      domainModuleId: 'dm-booking',
    },
    {
      id: 'bb-slot-hold',
      name: 'SlotHold',
      type: 'entity',
      boundedContextId: 'bc-scheduling',
      domainModuleId: 'dm-booking',
      description: 'Reserves a slot while the deposit is being authorised.',
      properties: [
        { id: 'prop-slot', name: 'slotId', type: 'TimeSlotId' },
        {
          id: 'prop-expires',
          name: 'expiresAt',
          type: 'Instant',
          description: 'Ten minutes after the hold is placed.',
        },
      ],
    },
  ],
  useCases: [
    {
      id: 'uc-book',
      name: 'Book appointment',
      type: 'Command',
      applicationServiceId: 'svc-booking',
      behaviourId: 'b-book',
      actorIds: ['act-patient', 'act-payments'],
      summary:
        'A patient turns an open slot into a confirmed appointment, securing it with a deposit.',
      description:
        'Booking is the clinic network’s core transaction. A booking is confirmed once a deposit has been authorised.',
      descriptionAuthor: 'human',
      rules: [
        {
          id: 'rule-hold',
          text: 'A hold expires after 10 minutes and returns the slot to the open pool.',
          ruleType: 'State change',
          author: 'human',
        },
        {
          id: 'rule-deposit',
          text: 'A booking is confirmed only after the deposit is authorised, or waived for an exempt patient.',
          author: 'agent',
        },
      ],
      input: {
        fields: [
          {
            id: 'fld-patient',
            name: 'patientId',
            label: 'Who the appointment is for',
            type: 'PatientId',
          },
          {
            id: 'fld-slot',
            name: 'slotId',
            label: 'Which slot',
            type: 'TimeSlotId',
            note: 'chosen from published availability',
          },
          {
            id: 'fld-intent',
            name: 'paymentIntentId',
            label: 'Deposit authorisation',
            type: 'PaymentIntentId | null',
          },
        ],
      },
      output: {
        summary: 'A confirmed appointment the patient can see immediately.',
        fields: [
          {
            id: 'fld-appt',
            name: 'appointmentId',
            label: 'The confirmed appointment',
            type: 'AppointmentId',
          },
        ],
      },
      acceptanceScenarios: [
        {
          id: 'as-book-happy',
          title: 'Patient books an available slot with a deposit',
          tags: ['@core', '@deposit'],
          background: [
            {
              id: 'st-bg-1',
              keyword: 'Given',
              text: 'clinician "Dr Okafor" has published availability for 3 March',
            },
          ],
          steps: [
            {
              id: 'st-1',
              keyword: 'Given',
              text: 'the 09:30 slot on 3 March is open',
            },
            { id: 'st-2', keyword: 'When', text: 'Ada books the 09:30 slot' },
            {
              id: 'st-3',
              keyword: 'And',
              text: 'her card authorises the £20 deposit',
            },
            {
              id: 'st-4',
              keyword: 'Then',
              text: 'the appointment is confirmed for 09:30 on 3 March',
            },
          ],
        },
        {
          id: 'as-book-declined',
          title: 'Declined deposit releases the held slot',
          kind: 'scenarioOutline',
          tags: ['@deposit', '@edge'],
          steps: [
            {
              id: 'st-5',
              keyword: 'Given',
              text: 'the <slot> slot on 3 March is open',
            },
            {
              id: 'st-6',
              keyword: 'When',
              text: 'her card authorisation fails with "<reason>"',
            },
            { id: 'st-7', keyword: 'Then', text: 'no appointment is created' },
          ],
          examples: {
            headers: ['slot', 'reason'],
            rows: [
              { id: 'row-1', cells: ['09:30', 'insufficient funds'] },
              { id: 'row-2', cells: ['11:00', 'card expired'] },
            ],
          },
        },
      ],
      qualityAttributes: [
        {
          id: 'qa-latency',
          name: 'Latency',
          text: 'Booking confirmation returns within 2 seconds at the 95th percentile.',
          type: 'performance',
        },
      ],
    },
    {
      id: 'uc-send-reminder',
      name: 'Send appointment reminder',
      type: 'Event',
      applicationServiceId: 'svc-booking',
      actorIds: [],
      summary: 'A reminder goes out a day before the appointment.',
      rules: [],
      input: { fields: [] },
      output: { summary: '', fields: [] },
      acceptanceScenarios: [],
      qualityAttributes: [],
    },
  ],
  // One entry-point behaviour, paired with its use case, and one interior
  // behaviour that belongs to a building block and no use case at all.
  behaviours: [
    {
      id: 'b-book',
      name: 'Book appointment',
      type: 'Command',
      buildingBlockId: 'svc-booking',
      useCaseId: 'uc-book',
    },
    {
      id: 'b-hold-place',
      name: 'SlotHold.place()',
      type: 'Command',
      buildingBlockId: 'bb-slot-hold',
    },
  ],
});
