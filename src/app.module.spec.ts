import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppModule', () => {
  let appModule: TestingModule;

  beforeAll(async () => {
    appModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    await appModule.init(); // Ensure the module is fully initialized
  });

  afterAll(async () => {
    await appModule.close(); // Ensure any resources are cleaned up
  });

  it('should be defined', () => {
    expect(appModule).toBeDefined();
  });

  it('should have ConfigModule imported', () => {
    const configModule = appModule.get(ConfigModule);
    expect(configModule).toBeDefined();
  });

  it('should have HttpModule imported', () => {
    const httpModule = appModule.get(HttpModule);
    expect(httpModule).toBeDefined();
  });

  it('should have AppController', () => {
    const appController = appModule.get(AppController);
    expect(appController).toBeDefined();
  });

  it('should have AppService', () => {
    const appService = appModule.get(AppService);
    expect(appService).toBeDefined();
  });



  it('should have CACHE_OPTIONS provider', () => {
    const cacheOptions = appModule.get('CACHE_OPTIONS');
    expect(cacheOptions).toBeDefined();
    expect(cacheOptions).toHaveProperty('enable');
    expect(cacheOptions).toHaveProperty('cacheTTLInHours');
  });


});
