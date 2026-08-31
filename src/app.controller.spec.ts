import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { vi } from 'vitest';

const mockPrismaService = { companies: { findMany: vi.fn() } };

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: 'PrismaService', useValue: mockPrismaService },
      ],
    })
      .overrideProvider(AppService)
      .useValue({ getHello: () => 'Hello World!' })
      .compile();

    appController = app.get<AppController>(AppController);
  });

  it('should return "Hello World!"', () => {
    expect(appController.getHello()).toBe('Hello World!');
  });
});
