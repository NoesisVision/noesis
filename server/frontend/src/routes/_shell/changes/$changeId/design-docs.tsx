import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_shell/changes/$changeId/design-docs')({
  component: Outlet,
});
