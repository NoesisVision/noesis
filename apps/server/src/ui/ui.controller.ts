import { Controller, Get } from '@nestjs/common';
import { uiRoutes } from '@repo/ui-contracts';
import { GreetingService } from '../greeting/greeting.service';

@Controller(uiRoutes.prefix)
export class UiController {
  constructor(private readonly greetingService: GreetingService) {}

  @Get(uiRoutes.hello)
  getHello(): string {
    return this.greetingService.getHello();
  }
}
