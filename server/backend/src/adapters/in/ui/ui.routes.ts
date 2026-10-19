import { Hono } from 'hono';
import { type ChangesDeps, createChangesApp } from './changes/changes.routes';
import {
  createDesignDocsApp,
  type DesignDocsDeps,
} from './design-docs/design-docs.routes';
import {
  createDocumentsApp,
  type DocumentsDeps,
} from './documents/documents.routes';
import { answerError } from './error-body';
import { createSearchApp, type SearchDeps } from './search/search.routes';
import {
  createSystemModelsApp,
  type SystemModelsDeps,
} from './system-models/system-models.routes';

/** Every handler the surface's routes call. */
export type UiDeps = SearchDeps &
  ChangesDeps &
  DesignDocsDeps &
  DocumentsDeps &
  SystemModelsDeps;

export function createUiApp(deps: UiDeps) {
  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .onError(answerError)
    .route('/search', createSearchApp(deps))
    .route('/changes', createChangesApp(deps))
    .route('/changes/:change/design-docs', createDesignDocsApp(deps))
    .route('/changes/:change/documents', createDocumentsApp(deps))
    .route('/system-models', createSystemModelsApp(deps));
}
