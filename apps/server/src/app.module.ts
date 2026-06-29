// Routes are segregated by consumer, one module per surface, so each surface
// can carry its own auth later: /ui (ui app), /api (local app / MCP),
// /internal (health and other technical endpoints).
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ApiModule } from './api/api.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { InternalModule } from './internal/internal.module';
import { ProjectsModule } from './projects/projects.module';
import { SchemaModule } from './schema/schema.module';
import { UiModule } from './ui/ui.module';

// Serving the built ui app (SPA at /, index.html fallback for client routes)
// is opt-in via UI_DIST_PATH — set in the production container, unset in dev
// (Vite serves the ui) and in tests. The route surfaces are excluded so their
// JSON 404s are not swallowed by the SPA fallback. Resolved to an absolute
// path: express's sendFile (the index.html fallback) rejects relative roots.
const uiDistPath = process.env.UI_DIST_PATH
  ? resolve(process.env.UI_DIST_PATH)
  : undefined;

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    SchemaModule,
    ProjectsModule,
    UiModule,
    ApiModule,
    InternalModule,
    ...(uiDistPath
      ? [
          ServeStaticModule.forRoot({
            rootPath: uiDistPath,
            exclude: ['/ui/{*path}', '/api/{*path}', '/internal/{*path}'],
          }),
        ]
      : []),
  ],
})
export class AppModule {}
