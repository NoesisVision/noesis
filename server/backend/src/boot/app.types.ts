import type { createUiApp } from '#backend/adapters/in/ui/ui.routes';

/** Use with hc<AppType>('/ui'): the mount prefix is not part of the type. */
export type AppType = ReturnType<typeof createUiApp>;
