import {
  type ConversationAnalysis,
  ConversationAnalysisSchema,
} from './information-sources/conversation-analysis';

/*
 * A small but complete conversation import, used by the import specs: one
 * turn with one fragment, a new parent topic, a new child topic grounded in
 * the fragment, and one decision under the child. The conversation id is a
 * placeholder the service replaces with the content hash.
 */
export const conversationAnalysisFixture: ConversationAnalysis =
  ConversationAnalysisSchema.parse({
    conversation: {
      conversation_id: 'placeholder-conv',
      time: '2026-09-12T10:00:00Z',
      main_topic: 'Slot holds',
      turns: [
        {
          index: 0,
          speaker: 'Ada',
          time: '10:00',
          fragments: [
            {
              index: 0,
              sentences: ['Hold a slot for ten minutes.'],
              categories: ['Decision'],
            },
          ],
        },
      ],
    },
    topics: [
      {
        id: 'new-parent',
        parent_id: null,
        is_new: true,
        title: 'Booking',
        short_summary: 'Booking in general.',
        long_summary: 'Everything about booking.',
        items: [],
        decisions: [],
        reviewed: false,
        decisions_extracted: false,
      },
      {
        id: 'new-child',
        parent_id: 'new-parent',
        is_new: true,
        title: 'Slot holds',
        short_summary: 'How slots are held.',
        long_summary: 'Slots are held for ten minutes.',
        items: [
          {
            type: 'conversation_fragment_ref',
            conversation_id: 'placeholder-conv',
            turn_index: 0,
            fragment_index: 0,
          },
        ],
        decisions: [
          {
            title: 'Hold slots for ten minutes',
            status: 'accepted',
            context: {
              text: 'Double bookings happened.',
              text_locked: false,
              supporting_info: [
                {
                  type: 'conversation_fragment_ref',
                  conversation_id: 'placeholder-conv',
                  turn_index: 0,
                  fragment_index: 0,
                },
              ],
            },
            decision: {
              text: 'Ten minutes.',
              text_locked: false,
              rationale: 'Long enough to pay.',
              rationale_locked: false,
              supporting_info: [],
            },
            alternative_options: [],
          },
        ],
        reviewed: false,
        decisions_extracted: true,
      },
    ],
  });
