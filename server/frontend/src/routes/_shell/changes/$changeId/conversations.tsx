import { createFileRoute } from '@tanstack/react-router';
import { ConversationsView } from '#/components/views/conversations';
import { CONVERSATIONS_ROUTE } from '#/routes/routes.ts';

export const Route = createFileRoute(CONVERSATIONS_ROUTE.routeId)({
  component: ConversationsView,
});
