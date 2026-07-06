import { beforeEach, describe, expect, it } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { GreetingService } from '../greeting/greeting.service';
import { ApiController } from './api.controller';

describe('ApiController', () => {
  let controller: ApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ApiController],
      providers: [GreetingService],
    }).compile();

    controller = app.get<ApiController>(ApiController);
  });

  it('returns the greeting', () => {
    expect(controller.getHello()).toBe('Hello World!');
  });
});
