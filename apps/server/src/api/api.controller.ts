import { Controller, Get } from '@nestjs/common';
import { apiRoutes } from '@repo/local-contracts';
import { GreetingService } from '../greeting/greeting.service';

@Controller(apiRoutes.prefix)
export class ApiController {
  constructor(private readonly greetingService: GreetingService) {}

  @Get(apiRoutes.hello)
  getHello(): string {
    return this.greetingService.getHello();
  }
}
