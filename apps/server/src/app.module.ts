// Routes are segregated by consumer, one module per surface, so each surface
// can carry its own auth later: /ui (ui app), /api (local app / MCP),
// /internal (health and other technical endpoints).
import { Module } from '@nestjs/common';
import { ApiModule } from './api/api.module';
import { InternalModule } from './internal/internal.module';
import { UiModule } from './ui/ui.module';

@Module({
  imports: [UiModule, ApiModule, InternalModule],
})
export class AppModule {}
