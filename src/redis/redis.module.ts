import { Global, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';

export const createRedisClient = (logger: Logger, redisOptions: RedisOptions = {}): Redis => {
  const redis = new Redis({

    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),

    retryStrategy: (times: number) => {
      if (times >= 10) {
        return null; // Stop retrying after 10 attempts
      }
      return Math.min(times * 100, 2000); // Retry after a delay
    },
    ...redisOptions,
  });

  // Event listeners for Redis
  redis.on('connect', () => {
    logger.log('🔌 Redis client connected.');
  });

  redis.on('ready', async () => {
    logger.log('✅ Redis client ready and operational. Flushing all cache entries...');
    try {
      await redis.flushdb(); // Clear all cached entries
      logger.log('🗑️ All cache entries flushed successfully.');
    } catch (error) {
      logger.error(`❌ Error flushing cache: ${error.message}`);
    }
  });

  redis.on('error', (error: Error) => {
    logger.warn(`❌ Redis error: ${error.message}`);
  });

  redis.on('end', () => {
    logger.warn('⚠️ Redis client disconnected.');
  });

  return redis;
};

@Global()
@Module({
  providers: [
    Logger, // <-- Explicitly providing Logger here
    {
      provide: 'REDIS',
      useFactory: (logger: Logger) => {
        return createRedisClient(logger);
      },
      inject: [Logger],
    },
  ],
  exports: ['REDIS'],
})
export class RedisModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly logger: Logger) {}

  onModuleInit() {
    this.logger.log('🚀 RedisModule initialized.');
  }

  onModuleDestroy() {
    this.logger.log('🛑 RedisModule destroyed.');
  }
}
