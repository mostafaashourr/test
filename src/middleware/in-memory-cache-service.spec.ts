import { Test, TestingModule } from '@nestjs/testing';
import { CacheOptions } from '@nestjs/cache-manager';
import Redis from 'ioredis';
import { NextFunction, Request, Response } from 'express';
import { InMemoryCache } from './in-memory-cache-service';
import { Constants } from '../common/constants/app.constants';
import { Logger } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';

jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn(),
}));

describe('InMemoryCache', () => {
  let inMemoryCache: InMemoryCache;
  let redisMock: jest.Mocked<Redis>;
  let optionsMock: CacheOptions;

  beforeEach(async () => {
    optionsMock = {
      enable: true,
      cacheTTLInHours: 1,
    } as CacheOptions;

    redisMock = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      ttl: jest.fn(),
      flushdb: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InMemoryCache,
        { provide: 'CACHE_OPTIONS', useValue: optionsMock },
        { provide: 'REDIS', useValue: redisMock },
      ],
    }).compile();

    inMemoryCache = module.get<InMemoryCache>(InMemoryCache);

    // Mock logger methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation(jest.fn());
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(jest.fn());
    jest.spyOn(Logger.prototype, 'error').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isCachingEnabled', () => {
    it('should return true when caching is enabled', () => {
      optionsMock.enable = true;
      expect(inMemoryCache.isCachingEnabled()).toBe(true);
    });

    it('should return false when caching is disabled', () => {
      optionsMock.enable = false;
      expect(inMemoryCache.isCachingEnabled()).toBe(false);
    });
  });

  describe('sendCachedResponse', () => {
    it('should send cached response with correct headers', () => {
      const resMock = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      const cachedResponse = '{"message": "hello"}';
      const url = '/test-url';

      inMemoryCache.sendCachedResponse(resMock, cachedResponse, url);

      expect(resMock.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(resMock.send).toHaveBeenCalledWith(cachedResponse);
    });
  });

  describe('getCachedResponse', () => {
    it('should return cached response if Redis returns value', async () => {
      const cacheKey = 'test-key';
      const cachedValue = '{"message": "cached"}';

      redisMock.get.mockResolvedValue(cachedValue);

      const result = await inMemoryCache.getCachedResponse(cacheKey, '/test-url');

      expect(result).toBe(cachedValue);
      expect(redisMock.get).toHaveBeenCalledWith(cacheKey);
    });

    it('should return null and log warning if Redis throws error', async () => {
      const cacheKey = 'test-key';

      redisMock.get.mockRejectedValue(new Error('Redis error'));

      const result = await inMemoryCache.getCachedResponse(cacheKey, '/test-url');

      expect(result).toBeNull();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        '🚨 Redis error for /test-url: [Redis error]. Proceeding without cache...',
      );
    });
  });

  describe('performCaching', () => {
    it('should cache response successfully', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await inMemoryCache.performCaching(key, value, '/test-url');

      expect(redisMock.setex).toHaveBeenCalledWith(
        key,
        optionsMock.cacheTTLInHours * 3600,
        value,
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith('✅ Cached response for /test-url');
    });

    it('should log error if caching fails', async () => {
      redisMock.setex.mockRejectedValue(new Error('Redis error'));

      await inMemoryCache.performCaching('test-key', 'test-value', '/test-url');

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        '❌ Error in caching process for /test-url: [Redis error]',
      );
    });
  });

  describe('getCacheKey', () => {
    it('should generate correct cache key', () => {
      const url = '/test-url';
      const keyType = 'basic';
      const expectedKey = `${Constants.REDIS_CACHE_PREFIX}_BASIC:${url}`;

      const result = inMemoryCache.getCacheKey(url, keyType);

      expect(result).toBe(expectedKey);
    });
  });

  describe('getCacheKeyPattern', () => {
    it('should generate correct cache key pattern', () => {
      const type = 'backup';
      const expectedPattern = `${Constants.REDIS_CACHE_PREFIX}_BACKUP`;

      const result = InMemoryCache.getCacheKeyPattern(type);

      expect(result).toBe(expectedPattern);
    });
  });

  describe('getBody', () => {
    it('should return an empty string when response body is empty', async () => {
      const mockIncomingMessage = new (require('stream')).Readable();
      mockIncomingMessage.push(null); // No data, just end of stream

      const result = await inMemoryCache.getBody(mockIncomingMessage);

      expect(result).toBe('');
    });

    it('should correctly concatenate response body chunks', async () => {
      const mockIncomingMessage = new (require('stream')).Readable();
      const mockBody = 'test body';
      mockIncomingMessage.push(mockBody);
      mockIncomingMessage.push(null); // End of stream

      const result = await inMemoryCache.getBody(mockIncomingMessage);

      expect(result).toBe(mockBody);
    });
  });

  describe('cacheMiddlewareWithServiceForward', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
      req = { originalUrl: '/test-url' };
      res = {
        setHeader: jest.fn(),
        send: jest.fn(),
        end: jest.fn(),
        status: jest.fn().mockReturnThis(),
        statusCode: 200,
      };
      next = jest.fn();
    });

    it('should skip caching and forward request if caching is disabled', async () => {
      optionsMock.enable = false;

      const middleware = inMemoryCache.cacheMiddlewareWithServiceForward();
      await middleware(req as Request, res as Response, next);

      expect(redisMock.get).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should cache and forward request if caching is enabled and cache is missing', async () => {
      const cacheKey = 'SUPERSEARCHMIDDLEWARE_BASIC:/test-url';
      const cachedResponse = null; // No cached response
      redisMock.get.mockResolvedValue(cachedResponse);
      redisMock.ttl.mockResolvedValue(-1); // TTL expired

      const proxyMiddleware = jest.fn((req, res, next) => {
        res.end('proxy response');
      });
      (createProxyMiddleware as jest.Mock).mockReturnValue(proxyMiddleware);

      const middleware = inMemoryCache.cacheMiddlewareWithServiceForward();
      await middleware(req as Request, res as Response, next);

      expect(redisMock.get).toHaveBeenCalledWith(cacheKey);
    });

    it('should return cached response if available', async () => {
      const cacheKey = 'SUPERSEARCHMIDDLEWARE_BASIC:/test-url';
      const cachedResponse = '{"message": "cached"}';
      redisMock.get.mockResolvedValue(cachedResponse);
      redisMock.ttl.mockResolvedValue(100);

      const middleware = inMemoryCache.cacheMiddlewareWithServiceForward();
      await middleware(req as Request, res as Response, next);

      expect(redisMock.get).toHaveBeenCalledWith(cacheKey);
    });
  });

  describe('proxyRequestWithCache', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
      req = { originalUrl: '/test-url' };
      res = {
        setHeader: jest.fn(),
        send: jest.fn(),
        end: jest.fn(),
        status: jest.fn().mockReturnThis(),
        statusCode: 200,
      };
      next = jest.fn();
    });

    it('should return 404 if no matching proxy route is found', () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        headersSent: false,
      } as unknown as Response;

      inMemoryCache.proxyRequestWithCache(req as Request, mockRes, 'cache-key', next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith('Not Found');
    });


  });
});
