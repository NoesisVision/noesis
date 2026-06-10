import { beforeEach, describe, expect, it } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { GreetingService } from '../greeting/greeting.service';
import { UiController } from './ui.controller';

describe('UiController', () => {
  let controller: UiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [UiController],
      providers: [GreetingService],
    }).compile();

    controller = app.get<UiController>(UiController);
  });

  it('returns the greeting', () => {
    expect(controller.getHello()).toBe('Hello World!');
  });
});
