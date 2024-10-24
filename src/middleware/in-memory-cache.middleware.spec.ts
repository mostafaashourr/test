import { Test, TestingModule } from '@nestjs/testing';
import { InMemoryCacheMiddleware } from './in-memory-cache.middleware';
import { InMemoryCache } from './in-memory-cache-service';
import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

describe('InMemoryCacheMiddleware', () => {
  let middleware: InMemoryCacheMiddleware;
  let cacheService: jest.Mocked<InMemoryCache>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InMemoryCacheMiddleware,
        {
          provide: InMemoryCache,
          useFactory: () => ({
            cacheMiddlewareWithServiceForward: jest.fn(),
          }),
        },
      ],
    }).compile();

    middleware = module.get<InMemoryCacheMiddleware>(InMemoryCacheMiddleware);
    cacheService = module.get(InMemoryCache) as jest.Mocked<InMemoryCache>;

    mockRequest = { originalUrl: '/test' };
    mockResponse = {};
    mockNext = jest.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should call cacheMiddlewareWithServiceForward', async () => {
    const mockMiddleware = jest.fn();
    cacheService.cacheMiddlewareWithServiceForward.mockReturnValue(mockMiddleware);

    await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    expect(cacheService.cacheMiddlewareWithServiceForward).toHaveBeenCalled();
    expect(mockMiddleware).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
  });

  it('should call next() if an error occurs', async () => {
    const mockError = new Error('Test error');
    cacheService.cacheMiddlewareWithServiceForward.mockImplementation(() => {
      throw mockError;
    });

    const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    expect(loggerSpy).toHaveBeenCalledWith(`Error in InMemoryCacheMiddleware for /test: Test error`);
    expect(mockNext).toHaveBeenCalled();

    loggerSpy.mockRestore();
  });
});
