import type { Handler } from '#backend/app/handler';
import type { SystemModel } from '#backend/app/system-model/system-model';

/**
 * Kept apart from its implementation: the routes reach this type from
 * AppType, which the frontend type-checks as browser code, so it must not
 * reach the scanner's Node imports.
 */
export type ScanSystemModelHandler = Handler<void, SystemModel>;
