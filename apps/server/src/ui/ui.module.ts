// Endpoints consumed by the ui app (`/ui/*`). When ui auth lands, bind its
// guard here (module-scoped APP_GUARD) — never on the other surfaces.
import { Module } from '@nestjs/common';
import { GreetingModule } from '../greeting/greeting.module';
import { UiController } from './ui.controller';

@Module({
  imports: [GreetingModule],
  controllers: [UiController],
})
export class UiModule {}
