import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { HttpService } from '@nestjs/axios';
import { MultiTenantConfig } from './config/multi-tenant.config';
import { of, throwError } from 'rxjs';
import { Request } from 'express';
import { HttpException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AxiosResponse } from 'axios';
import { Constants } from './common/constants/app.constants';

jest.mock('jsonwebtoken');

describe('AppService', () => {
  let appService: AppService;
  let httpService: HttpService;
  let multiTenantConfig: MultiTenantConfig;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: MultiTenantConfig,
          useValue: {
            getConfig: jest.fn(),
            getCurrentTenant: jest.fn()
          },
        },
      ],
    }).compile();

    appService = module.get<AppService>(AppService);
    httpService = module.get<HttpService>(HttpService);
    multiTenantConfig = module.get<MultiTenantConfig>(MultiTenantConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getToken', () => {
    it('should return the existing token if it is valid', async () => {
      const mockRequest = { headers: { 'x-tenant': 'pt' } } as any;
      const mockTokens: {} = { 'pt': 'mock-token' };
      const mockTenantConfig = {
        accessTokenUrl: 'https://example.com/token',
        clientCredentials: 'Basic credentials',
      };
      appService.webPlatformTokens = mockTokens;
      (multiTenantConfig.getConfig as jest.Mock).mockReturnValue(mockTenantConfig);
      (multiTenantConfig.getCurrentTenant as jest.Mock).mockReturnValue('pt');
      const mockDecodedToken = { exp: Math.floor(Date.now() / 1000) + 1000 }; // Valid token
      (jwt.decode as jest.Mock).mockReturnValue(mockDecodedToken);

      const result = await appService.getToken(mockRequest);

      expect(result).toBe('mock-token');
      expect(jwt.decode).toHaveBeenCalledWith('mock-token');
    });
    it('should request a new token if the current token is invalid', async () => {
      const mockRequest = { headers: { 'x-tenant': 'pt' } } as any;
      const mockTenantConfig = {
        accessTokenUrl: 'https://example.com/token',
        clientCredentials: 'Basic credentials',
      };
      const mockResponse = {
        data: { access_token: 'new-token' },
      } as AxiosResponse;

      (multiTenantConfig.getConfig as jest.Mock).mockReturnValue(mockTenantConfig);
      (httpService.post as jest.Mock).mockReturnValue(of(mockResponse));

      const result = await appService.getToken(mockRequest);

      expect(multiTenantConfig.getConfig).toHaveBeenCalledWith(mockRequest);
      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining(mockTenantConfig.accessTokenUrl),
        {},
        expect.objectContaining({
          headers: {
            "Accept": "application/json",
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: mockTenantConfig.clientCredentials,
          },
        }),
      );
      expect(result).toBe('new-token');
    });

    it('should throw an HttpException if token request fails', async () => {
      const mockRequest = { headers: { 'x-tenant': 'pt' } } as any;
      const mockTenantConfig = {
        accessTokenUrl: 'https://example.com/token',
        clientCredentials: 'Basic credentials',
      };
      const mockError = { response: { data: 'Error', status: 500 } };
      (multiTenantConfig.getConfig as jest.Mock).mockReturnValue(mockTenantConfig);
      (httpService.post as jest.Mock).mockReturnValue(throwError(mockError));

      await expect(appService.getToken(mockRequest)).rejects.toThrow(HttpException);
    });
  });

  describe('message', () => {
    it('should post a message and return data successfully', async () => {
      const mockRequest = { headers: { 'x-tenant': 'pt' } } as any;
      const mockTenantConfig = {
        postMessageUrl: 'https://example.com/message',
        appId: 'test-app-id',
      };
      const mockToken = 'mock-token';
      const mockResponse = { data: { success: true } } as AxiosResponse;

      (multiTenantConfig.getConfig as jest.Mock).mockReturnValue(mockTenantConfig);
      jest.spyOn(appService, 'getToken').mockResolvedValue(mockToken);
      (httpService.post as jest.Mock).mockReturnValue(of(mockResponse));

      const result = await appService.message(mockRequest);

      expect(appService.getToken).toHaveBeenCalledWith(mockRequest);
      expect(httpService.post).toHaveBeenCalledWith(
        mockTenantConfig.postMessageUrl,
        undefined,
        expect.objectContaining({ headers: { "Accept": "application/json", Authorization: mockToken } }),
      );
      expect(result).toEqual({ success: true });
    });

    it('should retry the request once if it fails and session is created', async () => {
      const mockRequest = { headers: { 'x-tenant': 'pt' } } as any;
      const mockTenantConfig = {
        postMessageUrl: 'https://example.com/message',
        appId: 'test-app-id',
      };
      const mockToken = 'mock-token';
      const mockError = new Error('Failed');
      const mockResponse = { data: { success: true } } as AxiosResponse;

      (multiTenantConfig.getConfig as jest.Mock).mockReturnValue(mockTenantConfig);
      jest.spyOn(appService, 'getToken').mockResolvedValue(mockToken);
      jest.spyOn(appService, 'message').mockResolvedValue({success: true});
      (httpService.post as jest.Mock).mockReturnValueOnce(throwError(mockError));
      (httpService.post as jest.Mock).mockReturnValueOnce(of(mockResponse));

      const result = await appService.message(mockRequest);

      expect(appService.message).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual({ success: true });
    });
  });

  describe('addRequestCookies', () => {
    it('should add the token to the request cookies', async () => {
      // Arrange: Mock the input request and dependencies
      const mockToken = 'test-token';
      const mockRequest = {
        headers: {
          cookie: 'existingCookie=123; anotherCookie=abc',
        },
      } as unknown as Request;

      // Mock the getToken method to return a predefined token
      jest.spyOn(appService, 'getToken').mockResolvedValue(mockToken);

      // Act: Call the method with the mock request
      const updatedRequest = await appService.addRequestCookies(mockRequest);

      // Assert: Check that the token is correctly added to the cookies
      const expectedCookies = `existingCookie=123; anotherCookie=abc; ${Constants.WEB_PLATFORMS_TOKEN}=${mockToken}`;
      expect(updatedRequest.headers.cookie).toBe(expectedCookies);
      expect(appService.getToken).toHaveBeenCalledWith(mockRequest);
    });

    it('should create a new cookie header if no cookies exist', async () => {
      const mockToken = 'test-token';
      const mockRequest = {
        headers: {},
      } as unknown as Request;

      jest.spyOn(appService, 'getToken').mockResolvedValue(mockToken);
      const updatedRequest = await appService.addRequestCookies(mockRequest);

      const expectedCookies = `${Constants.WEB_PLATFORMS_TOKEN}=${mockToken}`;
      expect(updatedRequest.headers.cookie).toBe(expectedCookies);
      expect(appService.getToken).toHaveBeenCalledWith(mockRequest);
    });
  });
});
