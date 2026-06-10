import { Controller, Get } from '@nestjs/common';

// Technical endpoints (`/internal/*`): health checks, future readiness/metrics.
// No external client package imports these paths — the Railway healthcheck is
// configured with the literal `/internal/health`. Keep this surface harmless
// while it is publicly reachable; anything sensitive needs a guard first.
@Controller('internal')
export class InternalController {
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
