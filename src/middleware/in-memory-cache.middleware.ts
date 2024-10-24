import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { InMemoryCache } from './in-memory-cache-service';


@Injectable()
export class InMemoryCacheMiddleware implements NestMiddleware {
  private readonly logger = new Logger(InMemoryCacheMiddleware.name);

  constructor(private readonly cacheService: InMemoryCache) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      this.cacheService.cacheMiddlewareWithServiceForward()(
        req,
        res,
        next,
      );
    } catch (error) {
      this.logger.error(`Error in InMemoryCacheMiddleware for ${req.originalUrl}: ${error.message}`);
      next();
    }
  }
}
