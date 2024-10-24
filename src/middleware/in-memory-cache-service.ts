import { Inject, Injectable, Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { Constants } from '../common/constants/app.constants';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as http from 'http';
import { CacheOptions } from '@nestjs/cache-manager';
import { PROXY_ROUTES } from '../config/proxy.config';

type CacheKeyType = 'basic' | 'backup';

@Injectable()
export class InMemoryCache {
  private readonly logger = new Logger(InMemoryCache.name);

  constructor(
    @Inject('CACHE_OPTIONS') private readonly options: CacheOptions,
    @Inject('REDIS') private readonly redis: Redis,
  ) {}

  /**
   * Middleware that handles caching and proxying.
   * If a cached response exists and is valid, it returns the cached response.
   * Otherwise, it proxies the request, caches the response, and returns the result.
   */
  cacheMiddlewareWithServiceForward() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.isCachingEnabled()) {
        return next();
      }

      const cacheKey = this.getCacheKey(req.originalUrl, 'basic');

      // Using async functions inside synchronous function
      (async () => {
        try {
          // Check if a valid cached response is available
          const cachedResponse = await this.getCachedResponse(
            cacheKey,
            req.originalUrl,
          );
          if (cachedResponse) {
            const ttl = await this.redis.ttl(cacheKey);
            if (ttl > 0) {
              return this.sendCachedResponse(
                res,
                cachedResponse,
                req.originalUrl,
              );
            } else {
              await this.redis.del(cacheKey); // Delete expired cache
            }
          }

          // Forward the request using proxy and cache the response
          this.proxyRequestWithCache(req, res, cacheKey, next);
        } catch (error) {
          this.logger.error(
            `❌ Error in cache middleware for ${req.originalUrl}: [${error.message}]`,
          );
          next(); // Call next middleware if an error occurs
        }
      })();
    };
  }

  /**
   * Proxies the request to the main service, caches the response if successful.
   */
  proxyRequestWithCache(
    req: Request,
    res: Response,
    cacheKey: string,
    next: NextFunction,
  ) {
    const matchedRoute = PROXY_ROUTES.find((route) =>
      req.originalUrl.startsWith(route.path),
    );

    if (!matchedRoute) {
      this.logger.error(`No matching route found for ${req.originalUrl}`);
      if (!res.headersSent) {
        res.status(404).send('Not Found');
      }
      return;
    }

    const proxyOptions = matchedRoute.proxy;

    this.logger.log(
      `Forwarding request to: ${proxyOptions.target}${req.originalUrl}`,
    );

    const proxy = createProxyMiddleware({
      ...proxyOptions, // Apply the proxy options from the matched route
      selfHandleResponse: true, // We handle the response manually
      on: {
        proxyReq: (proxyReq) => {
          // Remove Accept-Encoding header to avoid compressed responses
          proxyReq.removeHeader('Accept-Encoding');
        },
        proxyRes: (
          proxyRes: http.IncomingMessage,
          req: Request,
          res: Response,
        ) => {
          this.logger.log(
            `Received status code: ${proxyRes.statusCode} for ${req.originalUrl}`,
          );

          // Remove content-encoding header from the response
          delete proxyRes.headers['content-encoding'];

          const contentType = proxyRes.headers['content-type'] || '';
          const isTextResponse =
            contentType.includes('application/json') ||
            contentType.includes('text');

          if (proxyRes.statusCode === 200) {
            if (isTextResponse) {
              // Handle text-based response (JSON, HTML, etc.)
              this.getBody(proxyRes).then(responseBody => {
                this.performCaching(cacheKey, responseBody, req.originalUrl).catch(error => {
                  this.logger.error(
                    `❌ Error in caching process for ${req.originalUrl}: [${error.message}]`,
                  );
                });

                if (!res.headersSent) {
                  res.setHeader('Content-Type', contentType);
                  res.statusCode = proxyRes.statusCode || 200;
                  res.end(responseBody);
                }
              });
            } else {
              // Handle binary response (e.g., images, binary data)
              proxyRes.pipe(res); // Pipe binary data directly without converting to string
            }
          } else {
            // Directly pipe non-200 responses to the client without caching
            proxyRes.pipe(res);
          }
        },
        error: (err: Error, req: Request, res: Response) => {
          this.logger.error(
            `❌ Proxy error for ${req.originalUrl}: [${err.message}]`,
          );
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end('Error forwarding request.');
          }
        },
      },
    });

    proxy(req, res, next);
  }


  /**
   * Retrieves the response body without any decompression.
   */
  getBody(proxyRes: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const buffers: Buffer[] = [];

      proxyRes.on('data', (chunk) => {
        buffers.push(chunk);
      });

      proxyRes.on('end', () => {
        const buffer = Buffer.concat(buffers);
        resolve(buffer.toString()); // No decompression, return as is
      });

      proxyRes.on('error', reject);
    });
  }

  /**
   * Checks if caching is enabled based on the provided options.
   */
  isCachingEnabled(): boolean {
    return this.options.enable;
  }

  /**
   * Retrieves the cached response from Redis if available.
   * If Redis is down, log the error and proceed with the request.
   */
  async getCachedResponse(
    cacheKey: string,
    url: string,
  ): Promise<string | null> {
    try {
      return await this.redis.get(cacheKey);
    } catch (error) {
      this.logger.warn(
        `🚨 Redis error for ${url}: [${error.message}]. Proceeding without cache...`,
      );
      return null; // Return null to proceed to the main service
    }
  }

  /**
   * Sends the cached response to the client.
   */
  sendCachedResponse(res: Response, cachedResponse: string, url: string): void {
    this.logger.log(`➡️ Returning cached response for ${url}`);
    res.setHeader('Content-Type', 'application/json');
    res.send(cachedResponse);
  }

  /**
   * Caches the response asynchronously and logs any errors.
   */
  async performCaching(key: string, value: any, url: string): Promise<void> {
    try {
      const ttlInSeconds = this.options.cacheTTLInHours * 3600;
      await this.redis.setex(key, ttlInSeconds, value);
      this.logger.log(`✅ Cached response for ${url}`);
    } catch (error) {
      this.logger.error(
        `❌ Error in caching process for ${url}: [${error.message}]`,
      );
    }
  }

  /**
   * Constructs a cache key using the provided URL and cache type.
   */
  getCacheKey(url: string, type: CacheKeyType): string {
    return `${InMemoryCache.getCacheKeyPattern(type)}:${url}`;
  }

  /**
   * Generates the cache key pattern based on the cache type.
   */
  static getCacheKeyPattern(type: CacheKeyType): string {
    return `${Constants.REDIS_CACHE_PREFIX}_${type}`.toUpperCase();
  }
}
