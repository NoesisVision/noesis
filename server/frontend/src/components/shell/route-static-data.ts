// Per-route shell metadata. `breadcrumb` feeds the top bar (derived from the
// matched routes, so there is no separate breadcrumb map to keep in sync) and
// `viewId` keys the per-view right panel state.
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    breadcrumb?: string;
    viewId?: string;
  }
}

export {};
