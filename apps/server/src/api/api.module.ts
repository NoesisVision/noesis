// Endpoints consumed by the local app / MCP server (`/api/*`). When api auth
// lands (token/API key), bind its guard here — never on the other surfaces.
import { Module } from '@nestjs/common';
import { GreetingModule } from '../greeting/greeting.module';
import { ApiController } from './api.controller';

@Module({
  imports: [GreetingModule],
  controllers: [ApiController],
})
export class ApiModule {}
