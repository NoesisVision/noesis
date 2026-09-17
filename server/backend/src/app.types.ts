import type { createUiApp } from './ui/ui.routes.js';

/** UI routes only. Use with hc<AppType>('/ui'); the mount prefix is external. */
export type AppType = ReturnType<typeof createUiApp>;
