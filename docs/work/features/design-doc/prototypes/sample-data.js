/*
 * Shared Stage 1 sample design document.
 *
 * Domain: appointment booking for a clinic network.
 * Every Stage 1 prototype (A, D, E) renders this exact dataset, so the
 * comparison measures the interaction model rather than the content.
 *
 * Codebase-relative state follows section 2.6 of the specification:
 * `state` is derived from baseline-comparable fields only, and it never
 * propagates upward through containment.
 */
((global) => {
  const doc = {
    id: 'doc-appointments',
    name: 'Appointment booking',
    status: 'Draft',
    updated: '2026-08-14',
    baseline: {
      scanId: 'scan-2026-07-29',
      scannedAt: '2026-07-29',
      repository: 'clinic-platform',
      newerScan: { scanId: 'scan-2026-08-15', scannedAt: '2026-08-15' },
    },
    /* Typed document-level fields used by the document-view prototype. */
    goal: 'Let patients book, move and cancel clinic appointments themselves, and cut the no-show rate to under 5% by securing each booking with a deposit and a reminder.',
    businessContext: [
      {
        id: 'ctxp-1',
        text: 'The clinic network runs 12 sites and about 4,000 appointments a week. Roughly one in seven booked slots is never used and is discovered empty only when the patient fails to arrive, which costs clinician time that cannot be resold at short notice.',
      },
      {
        id: 'ctxp-2',
        text: 'Front desk agents currently absorb the problem manually: they phone patients the day before, keep paper waiting lists and re-book walk-ins into gaps. This does not scale with the two sites opening this year, and it makes availability data unreliable for everyone else.',
      },
      {
        id: 'ctxp-3',
        text: 'The no-show programme agreed with the clinical board has two levers: a small refundable deposit taken when the slot is booked, and an automatic reminder a day ahead. Both must work without making booking feel heavier for patients who always show up.',
      },
    ],
    outcomes: [
      {
        id: 'out-1',
        text: 'No-show rate below 5% within two quarters of launch.',
        measure: 'unused booked slots ÷ booked slots, weekly',
      },
      {
        id: 'out-2',
        text: 'At least 60% of bookings made by patients themselves rather than by a front desk agent.',
        measure: 'bookings by actor, weekly',
      },
      {
        id: 'out-3',
        text: 'No increase in booking abandonment after the deposit step is introduced.',
        measure: 'started bookings that reach confirmation',
      },
    ],
    scope: {
      inScope: [
        {
          id: 'sc-1',
          text: 'Booking, rescheduling and cancelling standard clinic appointments.',
        },
        {
          id: 'sc-2',
          text: 'Deposits, holds and refunds for those appointments.',
        },
        { id: 'sc-3', text: 'Confirmation and reminder messages over SMS.' },
      ],
      outOfScope: [
        { id: 'sc-4', text: 'Clinical records, triage and referral.' },
        {
          id: 'sc-5',
          text: 'Invoicing and insurance claims beyond the deposit.',
        },
        {
          id: 'sc-6',
          text: 'Walk-in queue management, retired with the walk-in booking use case.',
        },
      ],
    },
    comments: [
      {
        id: 'dcm-1',
        anchor: { binding: 'designDocument.goal', quote: 'under 5%' },
        author: 'Tomasz Lis',
        role: 'Architect',
        time: '4 days ago',
        body: 'Is 5% inside two quarters realistic? The deposit only lands for new bookings, so the first quarter still carries the old book.',
        resolved: false,
        replies: [
          {
            author: 'Maya Ruiz',
            role: 'Product',
            time: '4 days ago',
            body: 'Board agreed the target is measured on bookings made after launch. Wording of the outcome needs to say that.',
          },
        ],
      },
      {
        id: 'dcm-2',
        anchor: {
          binding: 'designDocument.scope.outOfScope[]',
          quote: 'Walk-in queue management',
        },
        author: 'Priya Nair',
        role: 'QA',
        time: 'last week',
        body: 'If walk-ins are out of scope, what does the front desk do with someone standing there? Worth one sentence in the business context.',
        resolved: true,
        replies: [
          {
            author: 'Maya Ruiz',
            role: 'Product',
            time: 'last week',
            body: 'They search same-day availability and book normally. Covered by the retired walk-in use case.',
          },
        ],
      },
    ],
    /* Tracked suggestions: proposed wording that is not part of the accepted
       document until someone accepts it, the way Google Docs suggestions work. */
    suggestions: [
      {
        id: 'sg-1',
        binding: 'useCase[uc-book-appointment].rules[]',
        quote: '10 minutes',
        replacement: '15 minutes',
        author: 'Tomasz Lis',
        role: 'Architect',
        time: '2 days ago',
        note: 'Card entry on mobile regularly runs past ten minutes; the hold expires mid-payment.',
      },
      {
        id: 'sg-2',
        binding: 'useCase[uc-cancel-appointment].rules[]',
        quote: '24 hours or more before the appointment',
        replacement:
          '24 hours or more before the appointment, or 12 hours or more when the booking was made in the same week',
        author: 'Maya Ruiz',
        role: 'Product',
        time: '3 hours ago',
        note: 'Support queue says same-week bookings cannot reach the 24-hour window. The pending proposal argues the same thing.',
      },
      {
        id: 'sg-3',
        binding: 'designDocument.scope.inScope[]',
        quote: 'Confirmation and reminder messages over SMS.',
        replacement: 'Confirmation and reminder messages over SMS and email.',
        author: 'Maya Ruiz',
        role: 'Product',
        time: 'yesterday',
        note: 'Email is in the launch scope for patients without a mobile number.',
      },
    ],
    hints: [
      {
        id: 'h1',
        text: '2 use cases have no acceptance scenarios',
        targets: ['uc-appointment-booked', 'uc-send-confirmation'],
      },
      {
        id: 'h2',
        text: '1 use case has no actors',
        targets: ['uc-appointment-booked'],
      },
    ],
  };

  const actors = [
    {
      id: 'act-patient',
      name: 'Patient',
      kind: 'human',
      state: 'existing',
      description:
        'Books, reschedules and cancels their own appointments through the patient app.',
    },
    {
      id: 'act-frontdesk',
      name: 'Front desk agent',
      kind: 'human',
      state: 'existing',
      description:
        'Books and adjusts appointments on behalf of patients at the clinic.',
    },
    {
      id: 'act-sms',
      name: 'SMS gateway',
      kind: 'system',
      state: 'existing',
      description:
        'External delivery provider for confirmations and reminders.',
    },
    {
      id: 'act-payments',
      name: 'Payment provider',
      kind: 'system',
      state: 'new',
      description:
        'Authorises and captures the deposit that now secures a booking.',
    },
  ];

  const blocks = [
    {
      id: 'bb-booking-svc',
      name: 'BookingService',
      type: 'application service',
      state: 'existing',
      contextId: 'bc-scheduling',
    },
    {
      id: 'bb-availability-svc',
      name: 'AvailabilityService',
      type: 'application service',
      state: 'existing',
      contextId: 'bc-scheduling',
    },
    {
      id: 'bb-notification-svc',
      name: 'NotificationService',
      type: 'application service',
      state: 'existing',
      contextId: 'bc-notifications',
    },
    {
      id: 'bb-reminder-svc',
      name: 'ReminderService',
      type: 'application service',
      state: 'new',
      contextId: 'bc-notifications',
    },

    {
      id: 'bb-appointment',
      name: 'Appointment',
      type: 'aggregate',
      state: 'modified',
      contextId: 'bc-scheduling',
      baselineDiff: [
        {
          field: 'structure',
          from: 'no deposit fields',
          to: 'depositState, holdRef added',
        },
      ],
    },
    {
      id: 'bb-schedule',
      name: 'Schedule',
      type: 'aggregate',
      state: 'existing',
      contextId: 'bc-scheduling',
    },
    {
      id: 'bb-slot-hold',
      name: 'SlotHold',
      type: 'entity',
      state: 'new',
      contextId: 'bc-scheduling',
    },
    {
      id: 'bb-time-slot',
      name: 'TimeSlot',
      type: 'value object',
      state: 'existing',
      contextId: 'bc-scheduling',
    },
    {
      id: 'bb-money',
      name: 'Money',
      type: 'value object',
      state: 'new',
      contextId: 'bc-scheduling',
    },
    {
      id: 'bb-appt-repo',
      name: 'AppointmentRepository',
      type: 'repository',
      state: 'modified',
      contextId: 'bc-scheduling',
      baselineDiff: [
        {
          field: 'structure',
          from: 'save(appointment)',
          to: 'save(appointment, holdRef)',
        },
      ],
    },
    {
      id: 'bb-schedule-repo',
      name: 'ScheduleRepository',
      type: 'repository',
      state: 'existing',
      contextId: 'bc-scheduling',
    },
    {
      id: 'bb-appt-factory',
      name: 'AppointmentFactory',
      type: 'factory',
      state: 'existing',
      contextId: 'bc-scheduling',
    },
    {
      id: 'bb-slot-allocator',
      name: 'SlotAllocator',
      type: 'domain service',
      state: 'existing',
      contextId: 'bc-scheduling',
    },
    {
      id: 'bb-walkin-allocator',
      name: 'WalkInAllocator',
      type: 'domain service',
      state: 'removed',
      contextId: 'bc-scheduling',
    },
    {
      id: 'bb-evt-booked',
      name: 'AppointmentBooked',
      type: 'domain event',
      state: 'modified',
      contextId: 'bc-scheduling',
      baselineDiff: [
        {
          field: 'structure',
          from: 'appointmentId, slotId',
          to: 'appointmentId, slotId, depositState',
        },
      ],
    },
    {
      id: 'bb-evt-released',
      name: 'SlotReleased',
      type: 'domain event',
      state: 'new',
      contextId: 'bc-scheduling',
    },
    {
      id: 'bb-cmd-book',
      name: 'BookAppointment',
      type: 'domain command',
      state: 'modified',
      contextId: 'bc-scheduling',
      baselineDiff: [
        {
          field: 'structure',
          from: 'patientId, slotId',
          to: 'patientId, slotId, paymentIntentId',
        },
      ],
    },
    {
      id: 'bb-qry-slots',
      name: 'FindAvailableSlots',
      type: 'domain query',
      state: 'modified',
      contextId: 'bc-scheduling',
      baselineDiff: [
        {
          field: 'structure',
          from: 'returns slotId[]',
          to: 'returns slot summaries with deposit amount',
        },
      ],
    },
    {
      id: 'bb-payments',
      name: 'PaymentProviderClient',
      type: 'external integration',
      state: 'new',
      contextId: 'bc-scheduling',
    },
    {
      id: 'bb-sms',
      name: 'SmsGatewayClient',
      type: 'external integration',
      state: 'existing',
      contextId: 'bc-notifications',
    },
    {
      id: 'bb-notification-log',
      name: 'NotificationLogEntry',
      type: 'entity',
      state: 'existing',
      contextId: 'bc-notifications',
    },
    {
      id: 'bb-reminder-plan',
      name: 'ReminderPlan',
      type: 'aggregate',
      state: 'new',
      contextId: 'bc-notifications',
    },
  ];

  /* Behaviours are graph nodes. Use-case behaviours carry `useCaseId`;
     building-block behaviours carry `blockId`. */
  const behaviours = [
    {
      id: 'b-book',
      name: 'Book appointment',
      useCaseId: 'uc-book-appointment',
      blockId: 'bb-booking-svc',
    },
    {
      id: 'b-cancel',
      name: 'Cancel appointment',
      useCaseId: 'uc-cancel-appointment',
      blockId: 'bb-booking-svc',
    },
    {
      id: 'b-search',
      name: 'Search available slots',
      useCaseId: 'uc-search-slots',
      blockId: 'bb-availability-svc',
    },
    {
      id: 'b-send-confirmation',
      name: 'Send booking confirmation',
      useCaseId: 'uc-send-confirmation',
      blockId: 'bb-notification-svc',
    },
    {
      id: 'b-send-reminder',
      name: 'Send appointment reminder',
      useCaseId: 'uc-send-reminder',
      blockId: 'bb-reminder-svc',
    },
    {
      id: 'b-hold',
      name: 'Hold slot during payment',
      useCaseId: 'uc-hold-slot',
      blockId: 'bb-booking-svc',
    },

    {
      id: 'b-slot-find',
      name: 'SlotAllocator.findOpenSlots()',
      blockId: 'bb-slot-allocator',
    },
    {
      id: 'b-schedule-read',
      name: 'ScheduleRepository.forClinician()',
      blockId: 'bb-schedule-repo',
    },
    { id: 'b-hold-place', name: 'SlotHold.place()', blockId: 'bb-slot-hold' },
    {
      id: 'b-hold-release',
      name: 'SlotHold.release()',
      blockId: 'bb-slot-hold',
    },
    {
      id: 'b-pay-authorize',
      name: 'PaymentProviderClient.authorize()',
      blockId: 'bb-payments',
    },
    {
      id: 'b-pay-refund',
      name: 'PaymentProviderClient.refund()',
      blockId: 'bb-payments',
    },
    {
      id: 'b-appt-create',
      name: 'AppointmentFactory.create()',
      blockId: 'bb-appt-factory',
    },
    {
      id: 'b-appt-save',
      name: 'AppointmentRepository.save()',
      blockId: 'bb-appt-repo',
    },
    { id: 'b-evt-booked', name: 'AppointmentBooked', blockId: 'bb-evt-booked' },
    { id: 'b-evt-released', name: 'SlotReleased', blockId: 'bb-evt-released' },
    { id: 'b-sms-send', name: 'SmsGatewayClient.send()', blockId: 'bb-sms' },
    {
      id: 'b-log-write',
      name: 'NotificationLogEntry.record()',
      blockId: 'bb-notification-log',
    },
    {
      id: 'b-plan-create',
      name: 'ReminderPlan.schedule()',
      blockId: 'bb-reminder-plan',
    },
    {
      id: 'b-appt-cancel',
      name: 'Appointment.cancel()',
      blockId: 'bb-appointment',
    },
  ];

  /* Behaviour-to-behaviour relationships: invokes | returns | emits. */
  const links = [
    {
      id: 'l-book-hold',
      from: 'b-book',
      to: 'b-hold-place',
      type: 'invokes',
      state: 'new',
      label: 'reserve slot for 10 minutes',
    },
    {
      id: 'l-book-pay',
      from: 'b-book',
      to: 'b-pay-authorize',
      type: 'invokes',
      state: 'new',
      label: 'authorize deposit',
    },
    {
      id: 'l-pay-return',
      from: 'b-pay-authorize',
      to: 'b-book',
      type: 'returns',
      state: 'new',
      label: 'authorization result',
    },
    {
      id: 'l-book-create',
      from: 'b-book',
      to: 'b-appt-create',
      type: 'invokes',
      state: 'existing',
    },
    {
      id: 'l-book-save',
      from: 'b-book',
      to: 'b-appt-save',
      type: 'invokes',
      state: 'existing',
    },
    {
      id: 'l-book-emit',
      from: 'b-book',
      to: 'b-evt-booked',
      type: 'emits',
      state: 'existing',
    },
    {
      id: 'l-booked-confirm',
      from: 'b-evt-booked',
      to: 'b-send-confirmation',
      type: 'invokes',
      state: 'existing',
    },
    {
      id: 'l-confirm-sms',
      from: 'b-send-confirmation',
      to: 'b-sms-send',
      type: 'invokes',
      state: 'existing',
    },
    {
      id: 'l-confirm-log',
      from: 'b-send-confirmation',
      to: 'b-log-write',
      type: 'invokes',
      state: 'existing',
    },
    {
      id: 'l-booked-reminder',
      from: 'b-evt-booked',
      to: 'b-send-reminder',
      type: 'invokes',
      state: 'new',
    },
    {
      id: 'l-reminder-plan',
      from: 'b-send-reminder',
      to: 'b-plan-create',
      type: 'invokes',
      state: 'new',
    },
    {
      id: 'l-book-release',
      from: 'b-book',
      to: 'b-hold-release',
      type: 'invokes',
      state: 'new',
      label: 'authorization declined',
    },
    {
      id: 'l-release-emit',
      from: 'b-hold-release',
      to: 'b-evt-released',
      type: 'emits',
      state: 'new',
    },

    {
      id: 'l-search-schedule',
      from: 'b-search',
      to: 'b-schedule-read',
      type: 'invokes',
      state: 'existing',
    },
    {
      id: 'l-search-allocate',
      from: 'b-search',
      to: 'b-slot-find',
      type: 'invokes',
      state: 'existing',
    },
    {
      id: 'l-allocate-return',
      from: 'b-slot-find',
      to: 'b-search',
      type: 'returns',
      state: 'modified',
      label: 'slot summaries with deposit amount',
    },

    {
      id: 'l-cancel-appt',
      from: 'b-cancel',
      to: 'b-appt-cancel',
      type: 'invokes',
      state: 'existing',
    },
    {
      id: 'l-cancel-refund',
      from: 'b-cancel',
      to: 'b-pay-refund',
      type: 'invokes',
      state: 'new',
      label: 'refund deposit inside policy window',
    },
    {
      id: 'l-cancel-emit',
      from: 'b-cancel',
      to: 'b-evt-released',
      type: 'emits',
      state: 'new',
    },
  ];

  const contexts = [
    {
      id: 'bc-scheduling',
      name: 'Scheduling',
      state: 'existing',
      services: [
        { id: 'bb-booking-svc', name: 'BookingService', state: 'existing' },
        {
          id: 'bb-availability-svc',
          name: 'AvailabilityService',
          state: 'existing',
        },
      ],
    },
    {
      id: 'bc-notifications',
      name: 'Notifications',
      state: 'existing',
      services: [
        {
          id: 'bb-notification-svc',
          name: 'NotificationService',
          state: 'existing',
        },
        { id: 'bb-reminder-svc', name: 'ReminderService', state: 'new' },
      ],
    },
  ];

  /* -------------------------------------------------------------- use cases */

  const uc = [];

  uc.push({
    id: 'uc-book-appointment',
    name: 'Book appointment',
    type: 'command',
    state: 'modified',
    serviceId: 'bb-booking-svc',
    contextId: 'bc-scheduling',
    actors: ['act-patient', 'act-frontdesk', 'act-payments'],
    behaviourId: 'b-book',
    baselineDiff: [
      {
        field: 'input structure',
        from: 'patientId, slotId',
        to: 'patientId, slotId, paymentIntentId',
      },
      {
        field: 'actor references',
        from: 'Patient, Front desk agent',
        to: 'Patient, Front desk agent, Payment provider',
      },
      {
        field: 'behaviour relationships',
        from: '3 links',
        to: '7 links (slot hold and deposit added)',
      },
    ],
    summary:
      'A patient or front desk agent turns an open slot into a confirmed appointment, securing it with a deposit.',
    description:
      "Booking is the clinic network's core transaction. The caller picks a published slot and commits to it. Since the no-show programme started, a booking is only confirmed once a deposit has been authorised, so the slot is held for a short window while payment is arranged and released automatically if authorisation fails.\n\nThe front desk path is identical to the patient path except that the agent may waive the deposit for patients flagged as exempt.",
    descriptionAuthor: 'human',
    rules: [
      {
        text: 'A slot may be held by at most one booking attempt at a time.',
        author: 'human',
      },
      {
        text: 'A hold expires after 10 minutes and returns the slot to the open pool.',
        author: 'human',
      },
      {
        text: 'A booking is confirmed only after the deposit is authorised, or waived by an agent for an exempt patient.',
        author: 'agent',
      },
      {
        text: 'A patient may not hold more than two slots at the same time.',
        author: 'human',
      },
    ],
    input: {
      fields: [
        {
          name: 'patientId',
          label: 'Who the appointment is for',
          type: 'PatientId',
          note: '',
        },
        {
          name: 'bookedBy',
          label: 'Who is booking',
          type: 'ActorRef',
          note: 'the patient themselves, or a front desk agent',
        },
        {
          name: 'slotId',
          label: 'Which slot',
          type: 'TimeSlotId',
          note: 'clinician, date and time chosen from published availability',
        },
        {
          name: 'visitReason',
          label: 'Reason for visit',
          type: 'string | null',
          note: 'optional free text shown to the clinician',
        },
        {
          name: 'paymentIntentId',
          label: 'Deposit authorisation',
          type: 'PaymentIntentId | null',
          note: 'null only when the deposit is waived',
          state: 'new',
        },
        {
          name: 'waiver',
          label: 'Deposit waiver',
          type: 'DepositWaiver | null',
          note: 'agent waiver, with a reason',
          state: 'new',
        },
      ],
    },
    output: {
      summary:
        'A confirmed appointment the patient can see immediately, plus a confirmation message. If the deposit is declined, nothing is booked and the slot returns to the open list.',
      fields: [
        {
          name: 'appointmentId',
          label: 'The confirmed appointment',
          type: 'AppointmentId',
          note: '',
        },
        {
          name: 'confirmedAt',
          label: 'When it was confirmed',
          type: 'Instant',
          note: '',
        },
        {
          name: 'depositState',
          label: 'Deposit outcome',
          type: "'authorized' | 'waived'",
          note: '',
          state: 'new',
        },
      ],
    },
    quality: [
      {
        name: 'Latency',
        text: 'Booking confirmation returns within 2 seconds at the 95th percentile, excluding payment provider time.',
      },
      {
        name: 'Consistency',
        text: 'A slot can never be confirmed for two patients, including under concurrent booking attempts.',
      },
      {
        name: 'Resilience',
        text: 'A payment provider timeout releases the hold rather than leaving the slot stranded.',
      },
    ],
    blocks: [
      'bb-booking-svc',
      'bb-appointment',
      'bb-slot-hold',
      'bb-time-slot',
      'bb-money',
      'bb-appt-factory',
      'bb-appt-repo',
      'bb-payments',
      'bb-evt-booked',
      'bb-evt-released',
      'bb-cmd-book',
    ],
    flow: [
      'l-book-hold',
      'l-book-pay',
      'l-pay-return',
      'l-book-create',
      'l-book-save',
      'l-book-emit',
      'l-booked-confirm',
      'l-confirm-sms',
      'l-booked-reminder',
      'l-book-release',
      'l-release-emit',
    ],
    scenarios: [
      {
        id: 'sc-book-happy',
        title: 'Patient books an available slot with a deposit',
        tags: ['@core', '@deposit'],
        background: [
          {
            kw: 'Given',
            text: 'clinician "Dr Okafor" has published availability for 3 March',
          },
          {
            kw: 'And',
            text: 'patient "Ada" is registered and not deposit-exempt',
          },
        ],
        steps: [
          { kw: 'Given', text: 'the 09:30 slot on 3 March is open' },
          { kw: 'When', text: 'Ada books the 09:30 slot' },
          { kw: 'And', text: 'her card authorises the £20 deposit' },
          {
            kw: 'Then',
            text: 'the appointment is confirmed for 09:30 on 3 March',
          },
          {
            kw: 'And',
            text: 'the slot is no longer offered to other patients',
          },
          { kw: 'And', text: 'Ada receives a booking confirmation' },
        ],
        path: [
          'l-book-hold',
          'l-book-pay',
          'l-pay-return',
          'l-book-create',
          'l-book-save',
          'l-book-emit',
          'l-booked-confirm',
          'l-confirm-sms',
          'l-booked-reminder',
        ],
      },
      {
        id: 'sc-book-declined',
        title: 'Declined deposit releases the held slot',
        tags: ['@deposit', '@edge'],
        outline: true,
        steps: [
          { kw: 'Given', text: 'the <slot> slot on 3 March is open' },
          { kw: 'When', text: 'Ada books the <slot> slot' },
          { kw: 'And', text: 'her card authorisation fails with "<reason>"' },
          { kw: 'Then', text: 'no appointment is created' },
          { kw: 'And', text: 'the <slot> slot is open again within 1 second' },
          {
            kw: 'And',
            text: 'Ada is told the booking was not completed because of "<reason>"',
          },
        ],
        examples: {
          headers: ['slot', 'reason'],
          rows: [
            ['09:30', 'insufficient funds'],
            ['11:00', 'card expired'],
            ['15:15', 'provider timeout'],
          ],
        },
        path: [
          'l-book-hold',
          'l-book-pay',
          'l-pay-return',
          'l-book-release',
          'l-release-emit',
        ],
      },
      {
        id: 'sc-book-waiver',
        title: 'Front desk waives the deposit for an exempt patient',
        tags: ['@frontdesk'],
        steps: [
          { kw: 'Given', text: 'patient "Ben" is flagged deposit-exempt' },
          {
            kw: 'When',
            text: 'a front desk agent books the 14:00 slot for Ben with waiver reason "concession scheme"',
          },
          {
            kw: 'Then',
            text: 'the appointment is confirmed without a payment authorisation',
          },
          {
            kw: 'And',
            text: 'the waiver reason is recorded against the appointment',
          },
        ],
        path: [
          'l-book-hold',
          'l-book-create',
          'l-book-save',
          'l-book-emit',
          'l-booked-confirm',
          'l-confirm-sms',
        ],
      },
    ],
    comments: [
      {
        id: 'cm-1',
        anchor: {
          binding: 'useCase[uc-book-appointment].rules[]',
          quote: 'A hold expires after 10 minutes',
        },
        author: 'Maya Ruiz',
        role: 'Product',
        time: '2 days ago',
        body: 'Ten minutes feels long for a busy Monday clinic. Do we have data on how long card authorisation actually takes?',
        resolved: false,
        replies: [
          {
            author: 'Tomasz Lis',
            role: 'Architect',
            time: '2 days ago',
            body: 'Median is 3s, 99th percentile 40s. Ten minutes is for the patient filling in card details, not the provider round trip.',
          },
        ],
      },
      {
        id: 'cm-2',
        anchor: {
          binding: 'acceptanceScenario[sc-book-declined]',
          quote: 'Declined deposit releases the held slot',
        },
        author: 'Priya Nair',
        role: 'QA',
        time: 'yesterday',
        body: '@Tomasz we also need a scenario for two patients racing for the same slot while one holds it. Is that the same path or a branch?',
        resolved: false,
        replies: [
          {
            author: 'Tomasz Lis',
            role: 'Architect',
            time: 'yesterday',
            body: 'A branch: the second attempt never reaches the payment step. Worth its own scenario.',
          },
        ],
      },
      {
        id: 'cm-3',
        anchor: {
          binding: 'useCase[uc-book-appointment].input.fields[]',
          quote: 'Deposit waiver',
        },
        author: 'Sam Whitfield',
        role: 'Developer',
        time: 'last week',
        body: 'Waiver reason should be a closed list, not free text.',
        resolved: true,
        replies: [
          {
            author: 'Maya Ruiz',
            role: 'Product',
            time: 'last week',
            body: 'Agreed, added to Rules.',
          },
        ],
      },
    ],
  });

  uc.push({
    id: 'uc-search-slots',
    name: 'Search available slots',
    type: 'query',
    state: 'modified',
    serviceId: 'bb-availability-svc',
    contextId: 'bc-scheduling',
    actors: ['act-patient', 'act-frontdesk'],
    behaviourId: 'b-search',
    baselineDiff: [
      {
        field: 'output structure',
        from: 'slotId[]',
        to: 'slot summaries including deposit amount',
      },
    ],
    summary:
      "Show the open slots that match a patient's clinic, clinician and date-range preferences.",
    description:
      'The search is the entry point to booking, so it must reflect holds immediately: a slot held by another patient is not offered. Results now carry the deposit amount so the patient sees the cost before committing.',
    rules: [
      {
        text: 'Held and blocked slots are excluded from results.',
        author: 'agent',
      },
      { text: 'Results never span more than 60 days.', author: 'human' },
    ],
    input: {
      fields: [
        {
          name: 'clinicId',
          label: 'Which clinic',
          type: 'ClinicId | null',
          note: 'clinic or clinician is required',
        },
        {
          name: 'clinicianId',
          label: 'Which clinician',
          type: 'ClinicianId | null',
          note: '',
        },
        {
          name: 'range',
          label: 'Date range',
          type: 'DateRange',
          note: 'defaults to the next 14 days',
        },
        {
          name: 'appointmentType',
          label: 'Appointment type',
          type: 'AppointmentType',
          note: 'controls slot length',
        },
      ],
    },
    output: {
      summary:
        'A list of bookable times with clinician, location, duration and the deposit required.',
      fields: [
        {
          name: 'slots',
          label: 'Bookable slots',
          type: 'SlotSummary[]',
          note: 'was TimeSlotId[]',
          state: 'modified',
        },
        {
          name: 'slots[].depositAmount',
          label: 'Deposit required',
          type: 'Money',
          note: '',
          state: 'new',
        },
      ],
    },
    quality: [
      {
        name: 'Latency',
        text: 'Returns within 400 ms at the 95th percentile for a 14-day range.',
      },
    ],
    blocks: [
      'bb-availability-svc',
      'bb-schedule',
      'bb-time-slot',
      'bb-slot-allocator',
      'bb-schedule-repo',
      'bb-qry-slots',
      'bb-money',
    ],
    flow: ['l-search-schedule', 'l-search-allocate', 'l-allocate-return'],
    scenarios: [
      {
        id: 'sc-search-basic',
        title: 'Held slots are not offered',
        tags: ['@core'],
        steps: [
          {
            kw: 'Given',
            text: 'the 09:30 slot on 3 March is held by another booking attempt',
          },
          { kw: 'When', text: 'Ada searches 3 March for Dr Okafor' },
          { kw: 'Then', text: 'the 09:30 slot is not in the results' },
          { kw: 'And', text: 'every returned slot shows its deposit amount' },
        ],
        path: ['l-search-schedule', 'l-search-allocate', 'l-allocate-return'],
      },
    ],
    comments: [],
  });

  uc.push({
    id: 'uc-cancel-appointment',
    name: 'Cancel appointment',
    type: 'command',
    state: 'modified',
    serviceId: 'bb-booking-svc',
    contextId: 'bc-scheduling',
    actors: ['act-patient', 'act-frontdesk', 'act-payments'],
    behaviourId: 'b-cancel',
    baselineDiff: [
      {
        field: 'actor references',
        from: 'Patient, Front desk agent',
        to: 'Patient, Front desk agent, Payment provider',
      },
      {
        field: 'behaviour relationships',
        from: '1 link',
        to: '3 links (refund and slot release added)',
      },
    ],
    summary:
      'Release a booked appointment and, inside the policy window, refund the deposit.',
    description:
      'Cancellation frees the slot for other patients. The deposit is refunded when the cancellation arrives at least 24 hours before the appointment; otherwise it is retained, which is the point of the no-show programme.',
    descriptionAuthor: 'human',
    rules: [
      {
        text: 'Deposits are refunded for cancellations made 24 hours or more before the appointment.',
        author: 'human',
        challenged: true,
      },
      {
        text: 'A cancelled slot returns to the open pool immediately.',
        author: 'human',
      },
    ],
    input: {
      fields: [
        {
          name: 'appointmentId',
          label: 'Which appointment',
          type: 'AppointmentId',
          note: '',
        },
        {
          name: 'cancelledBy',
          label: 'Who is cancelling',
          type: 'ActorRef',
          note: 'the patient, or a front desk agent on their behalf',
        },
        {
          name: 'reason',
          label: 'Cancellation reason',
          type: 'string | null',
          note: 'optional, shown to the clinic',
        },
      ],
    },
    output: {
      summary:
        'The slot is open again and the patient is told whether the deposit was refunded.',
      fields: [
        {
          name: 'refunded',
          label: 'Whether the deposit came back',
          type: 'boolean',
          note: '',
          state: 'new',
        },
        {
          name: 'releasedSlotId',
          label: 'The slot that reopened',
          type: 'TimeSlotId',
          note: '',
        },
      ],
    },
    quality: [
      {
        name: 'Auditability',
        text: 'Every refund decision records the policy window applied at the time.',
      },
    ],
    blocks: [
      'bb-booking-svc',
      'bb-appointment',
      'bb-payments',
      'bb-evt-released',
      'bb-appt-repo',
    ],
    flow: ['l-cancel-appt', 'l-cancel-refund', 'l-cancel-emit'],
    scenarios: [
      {
        id: 'sc-cancel-refund',
        title: 'Cancelling early refunds the deposit',
        tags: ['@deposit'],
        steps: [
          {
            kw: 'Given',
            text: 'Ada has a confirmed appointment on 3 March at 09:30',
          },
          { kw: 'When', text: 'she cancels it on 1 March' },
          { kw: 'Then', text: 'the deposit is refunded' },
          { kw: 'And', text: 'the 09:30 slot is open again' },
        ],
        path: ['l-cancel-appt', 'l-cancel-refund', 'l-cancel-emit'],
      },
      {
        id: 'sc-cancel-late',
        title: 'Cancelling late retains the deposit',
        tags: ['@deposit', '@edge'],
        steps: [
          {
            kw: 'Given',
            text: 'Ada has a confirmed appointment on 3 March at 09:30',
          },
          { kw: 'When', text: 'she cancels it on 3 March at 08:00' },
          { kw: 'Then', text: 'the deposit is retained' },
          { kw: 'And', text: 'the 09:30 slot is open again' },
        ],
        path: ['l-cancel-appt', 'l-cancel-emit'],
      },
    ],
    comments: [
      {
        id: 'cm-4',
        anchor: {
          binding: 'useCase[uc-cancel-appointment].rules[]',
          quote:
            'Deposits are refunded for cancellations made 24 hours or more',
        },
        author: 'Tomasz Lis',
        role: 'Architect',
        time: '3 hours ago',
        body: 'The pending proposal challenges this rule and asks for 12 hours on same-week bookings. Worth deciding here before we review the proposal.',
        resolved: false,
        replies: [],
      },
    ],
  });

  uc.push({
    id: 'uc-hold-slot',
    name: 'Hold slot during payment',
    type: 'command',
    state: 'new',
    serviceId: 'bb-booking-svc',
    contextId: 'bc-scheduling',
    actors: ['act-patient', 'act-payments'],
    behaviourId: 'b-hold',
    summary:
      'Reserve a slot for a short window while the patient arranges the deposit.',
    description:
      'The hold is what keeps two patients from paying for the same slot. It is deliberately short and expires without any human action.',
    rules: [
      {
        text: 'A hold expires 10 minutes after it is placed.',
        author: 'agent',
      },
      {
        text: 'Placing a hold on an already-held slot is rejected, not queued.',
        author: 'agent',
      },
    ],
    input: {
      fields: [
        {
          name: 'slotId',
          label: 'Which slot',
          type: 'TimeSlotId',
          note: '',
        },
        {
          name: 'patientId',
          label: 'Who is holding it',
          type: 'PatientId',
          note: '',
        },
      ],
    },
    output: {
      summary:
        'A hold that expires on its own, or a clear "already taken" answer.',
      fields: [
        {
          name: 'holdRef',
          label: 'The hold',
          type: 'SlotHoldId',
          note: '',
        },
        {
          name: 'expiresAt',
          label: 'When it expires',
          type: 'Instant',
          note: '',
        },
      ],
    },
    quality: [
      {
        name: 'Consistency',
        text: 'Two concurrent hold attempts on one slot result in exactly one hold.',
      },
    ],
    blocks: [
      'bb-slot-hold',
      'bb-time-slot',
      'bb-booking-svc',
      'bb-evt-released',
    ],
    flow: ['l-book-hold', 'l-book-release', 'l-release-emit'],
    scenarios: [
      {
        id: 'sc-hold-race',
        title: 'Two patients race for one slot',
        tags: ['@edge', '@concurrency'],
        steps: [
          { kw: 'Given', text: 'the 09:30 slot on 3 March is open' },
          {
            kw: 'When',
            text: 'Ada and Ben both request a hold within the same second',
          },
          { kw: 'Then', text: 'exactly one hold is placed' },
          {
            kw: 'And',
            text: 'the other request is told the slot is no longer available',
          },
        ],
        path: ['l-book-hold'],
      },
    ],
    comments: [],
  });

  uc.push({
    id: 'uc-send-reminder',
    name: 'Send appointment reminder',
    type: 'command',
    state: 'new',
    serviceId: 'bb-reminder-svc',
    contextId: 'bc-notifications',
    actors: ['act-patient', 'act-sms'],
    summary: 'Send the patient a reminder 24 hours before the appointment.',
    description:
      'Reminders are the second half of the no-show programme. Delivery failures are logged but never block the appointment.',
    rules: [
      {
        text: 'A reminder is sent once; a delivery failure is logged, not retried indefinitely.',
        author: 'human',
      },
    ],
    input: {
      fields: [
        {
          name: 'appointmentId',
          label: 'Which appointment',
          type: 'AppointmentId',
          note: '',
        },
        {
          name: 'channel',
          label: 'Channel',
          type: "'sms'",
          note: 'SMS today; email planned',
        },
      ],
    },
    output: {
      summary:
        'The patient receives a reminder, and the clinic can see whether it arrived.',
      fields: [
        {
          name: 'deliveryId',
          label: 'The reminder that was sent',
          type: 'DeliveryId',
          note: '',
        },
      ],
    },
    quality: [
      {
        name: 'Timeliness',
        text: 'Reminders are sent within 5 minutes of the scheduled send time.',
      },
    ],
    blocks: [
      'bb-reminder-svc',
      'bb-reminder-plan',
      'bb-sms',
      'bb-notification-log',
    ],
    flow: ['l-reminder-plan'],
    scenarios: [
      {
        id: 'sc-reminder',
        title: 'Reminder is sent a day before',
        tags: ['@reminders'],
        steps: [
          {
            kw: 'Given',
            text: 'Ada has a confirmed appointment on 3 March at 09:30',
          },
          { kw: 'When', text: 'the clock reaches 09:30 on 2 March' },
          {
            kw: 'Then',
            text: 'Ada receives a reminder naming the clinician, time and location',
          },
        ],
        path: ['l-reminder-plan'],
      },
    ],
    comments: [],
  });

  /* Lighter-weight use cases: enough to exercise catalogue, canvas and filters. */
  const light = [
    [
      'uc-appointment-booked',
      'Appointment booked',
      'event',
      'modified',
      'bb-booking-svc',
      'bc-scheduling',
      [],
      'Published when a booking is confirmed, so notifications and reminders can react.',
      [
        {
          field: 'output structure',
          from: 'appointmentId, slotId',
          to: 'appointmentId, slotId, depositState',
        },
      ],
    ],
    [
      'uc-register-walkin',
      'Register walk-in booking',
      'command',
      'removed',
      'bb-booking-svc',
      'bc-scheduling',
      ['act-frontdesk'],
      'Retired: a same-day search plus an ordinary booking replaces the separate walk-in path.',
    ],
    [
      'uc-send-confirmation',
      'Send booking confirmation',
      'command',
      'existing',
      'bb-notification-svc',
      'bc-notifications',
      ['act-patient', 'act-sms'],
      'Send the patient the details of a newly confirmed appointment.',
    ],
  ];

  for (const [
    id,
    name,
    type,
    state,
    serviceId,
    contextId,
    actorIds,
    summary,
    baselineDiff,
  ] of light) {
    uc.push({
      id,
      name,
      type,
      state,
      serviceId,
      contextId,
      actors: actorIds,
      baselineDiff: baselineDiff || undefined,
      summary,
      description: '',
      rules: [],
      input: { fields: [] },
      output: { summary: '', fields: [] },
      quality: [],
      blocks: [serviceId],
      flow: [],
      scenarios: [],
      comments: [],
      behaviourId:
        id === 'uc-send-confirmation' ? 'b-send-confirmation' : undefined,
    });
  }

  /* --------------------------------------------------------- pending proposal */

  const proposal = {
    id: 'prop-deposit',
    title: 'Deposit-secured booking and reminder programme',
    author: 'Design agent',
    createdAt: '3 hours ago',
    trigger:
      'Re-analysis of the scanned codebase against the no-show reduction brief — nobody asked for this change directly',
    summary:
      'Introduces a short slot hold and a deposit authorisation before a booking is confirmed, adds a reminder service, and retires the separate walk-in path. Accepting applies the whole proposal.',
    impact: {
      added: [
        {
          id: 'uc-hold-slot',
          kind: 'Use case',
          name: 'Hold slot during payment',
        },
        {
          id: 'uc-send-reminder',
          kind: 'Use case',
          name: 'Send appointment reminder',
        },
        {
          id: 'bb-reminder-svc',
          kind: 'Application service',
          name: 'ReminderService',
        },
        { id: 'bb-slot-hold', kind: 'Building block', name: 'SlotHold' },
        {
          id: 'bb-payments',
          kind: 'Building block',
          name: 'PaymentProviderClient',
        },
        { id: 'act-payments', kind: 'Actor', name: 'Payment provider' },
      ],
      changed: [
        {
          id: 'uc-book-appointment',
          kind: 'Use case',
          name: 'Book appointment',
          detail:
            'input gains paymentIntentId and waiver; 4 behaviour links added',
        },
        {
          id: 'uc-cancel-appointment',
          kind: 'Use case',
          name: 'Cancel appointment',
          detail: 'refund and slot-release links added',
        },
        {
          id: 'uc-search-slots',
          kind: 'Use case',
          name: 'Search available slots',
          detail: 'output returns slot summaries with deposit amount',
        },
        {
          id: 'bb-appointment',
          kind: 'Building block',
          name: 'Appointment',
          detail: 'depositState and holdRef added',
        },
      ],
      removed: [
        {
          id: 'uc-register-walkin',
          kind: 'Use case',
          name: 'Register walk-in booking',
        },
        {
          id: 'bb-walkin-allocator',
          kind: 'Building block',
          name: 'WalkInAllocator',
        },
      ],
      specOnly: [
        {
          id: 'uc-book-appointment',
          kind: 'Acceptance scenario',
          name: 'Concurrent booking attempts on one slot',
          detail:
            'the hold introduces a race the current scenarios do not cover',
        },
        {
          id: 'uc-hold-slot',
          kind: 'Description',
          name: 'Hold slot during payment',
          detail: 'description and rules written',
        },
      ],
      contexts: ['Scheduling', 'Notifications'],
      services: [
        'BookingService',
        'AvailabilityService',
        'NotificationService',
        'ReminderService',
      ],
    },
    challenges: [
      {
        target: 'uc-cancel-appointment',
        targetName: 'Cancel appointment',
        field: 'Rules — refund window',
        human:
          'Deposits are refunded for cancellations made 24 hours or more before the appointment.',
        proposed:
          'Deposits are refunded 24 hours or more before the appointment, or 12 hours or more when the booking was made in the same week.',
        author: 'Maya Ruiz',
        reason:
          'The 24-hour rule was written before same-week bookings existed. A patient who books on Tuesday for Thursday cannot reach the 24-hour window without cancelling almost immediately, which the support queue shows as the top complaint. The shorter window applies only to bookings made in the same week, so the no-show deterrent is unchanged for planned appointments.',
      },
    ],
  };

  /* ---------------------------------------------------------------- presence */

  const presence = [
    {
      name: 'Maya Ruiz',
      role: 'Product',
      initials: 'MR',
      colour: 'oklch(0.62 0.14 39)',
    },
    {
      name: 'Tomasz Lis',
      role: 'Architect',
      initials: 'TL',
      colour: 'oklch(0.6 0.13 250)',
    },
    {
      name: 'Priya Nair',
      role: 'QA',
      initials: 'PN',
      colour: 'oklch(0.58 0.12 150)',
    },
    {
      name: 'Design agent',
      role: 'Agent',
      initials: 'AI',
      colour: 'oklch(0.55 0.02 100)',
      agent: true,
    },
  ];

  const mentionable = [
    { id: 'maya', label: 'Maya Ruiz', hint: 'Product' },
    { id: 'tomasz', label: 'Tomasz Lis', hint: 'Architect' },
    { id: 'priya', label: 'Priya Nair', hint: 'QA' },
    { id: 'sam', label: 'Sam Whitfield', hint: 'Developer' },
  ];

  global.SAMPLE = {
    doc,
    actors,
    contexts,
    blocks,
    behaviours,
    links,
    useCases: uc,
    proposal,
    presence,
    mentionable,
  };
})(window);
