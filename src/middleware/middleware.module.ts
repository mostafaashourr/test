import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { InMemoryCacheMiddleware } from './in-memory-cache.middleware'; // Ensure correct path for middleware
import { RedisModule } from '../redis/redis.module'; // Ensure correct path for RedisModule
import { HttpModule } from '@nestjs/axios';
import { InMemoryCache } from './in-memory-cache-service';
import { PROXY_ROUTES } from '../config/proxy.config'; // Import HttpModule for HttpService

@Module({
  imports: [HttpModule, RedisModule], // Ensure HttpModule and RedisModule are imported
  providers: [
    InMemoryCache,
    {
      provide: 'CACHE_OPTIONS',
      useValue: {
        enable: true,
        cacheTTLInHours: Number(process.env.CACHE_TTL_INHOURS) || 4,
      },
    },
  ],
  exports: [InMemoryCache],
})
export class MiddlewareModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply InMemoryCacheMiddleware to all specified routes
    PROXY_ROUTES.forEach((route) => {
      consumer.apply(InMemoryCacheMiddleware).forRoutes({
        path: route.path + '/*',
        method: RequestMethod[route.method as keyof typeof RequestMethod],
      });
    });
  }
}
