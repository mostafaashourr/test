import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Request, Response } from 'express';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { MultiTenantConfig } from './config/multi-tenant.config';

describe('AppController', () => {
  const httpService = new HttpService();
  const configService = new ConfigService();
  const multiTenantConfig = new MultiTenantConfig(configService);

  const appService = new AppService(
    httpService,
    multiTenantConfig
  );
  const appController = new AppController(appService);

  let req: Request;
  let res: Response;

  beforeEach(async () => {
    req = {} as Request;
    res = {} as Response;
  });

  describe('getStatus', () => {
    it('should return "Server is Up"', async () => {
      const res = {
        json: jest.fn().mockReturnThis(),
      } as any as Response;

      await appController.getStatus(res);
      expect(res.json).toHaveBeenCalledWith({ Message: 'Server is Up' });
    });
  });

  describe('sendMessage', () => {
    it('should call the appService.postMessage method and return the result', async () => {
      const data = 'test-data';
      jest
        .spyOn(appService, 'message')
        .mockResolvedValue(Promise.resolve(data));

      const result = await appController.sendEvent(req);

      expect(appService.message).toHaveBeenCalledWith(req);
      expect(result).toEqual(data);
    });
  });
});
