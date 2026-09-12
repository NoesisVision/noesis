import { createFileRoute } from '@tanstack/react-router';
import { ConversationsView } from '#/components/views/conversations';

export const Route = createFileRoute('/_shell/changes/$changeId/conversations')(
  {
    staticData: { breadcrumb: ['Conversations'] },
    component: ConversationsView,
  },
);
