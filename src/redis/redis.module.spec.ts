import { Logger } from '@nestjs/common';
import { createRedisClient } from './redis.module';
import Redis from 'ioredis';

describe('RedisModule', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('TestLogger');
    jest.spyOn(logger, 'log').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  it('should create a Redis client and set up event listeners', () => {
    const redis = createRedisClient(logger);

    expect(redis).toBeInstanceOf(Redis);

    // Simulate 'connect' event
    redis.emit('connect');
    expect(logger.log).toHaveBeenCalledWith('🔌 Redis client connected.');

    // Simulate 'ready' event
    jest.spyOn(redis, 'flushdb').mockResolvedValue('OK'); // Mock flushdb method
    redis.emit('ready');
    expect(logger.log).toHaveBeenCalledWith('✅ Redis client ready and operational. Flushing all cache entries...');
    expect(redis.flushdb).toHaveBeenCalled();


    // Simulate 'error' event
    redis.emit('error', new Error('Test Error'));
    expect(logger.warn).toHaveBeenCalledWith('❌ Redis error: Test Error');

    // Simulate 'end' event
    redis.emit('end');
    expect(logger.warn).toHaveBeenCalledWith('⚠️ Redis client disconnected.');
  });

  it('should log an error if flushdb fails during the ready event', async () => {
    const redis = createRedisClient(logger);

    jest.spyOn(redis, 'flushdb').mockRejectedValue(new Error('Flush Error'));

    // Simulate 'ready' event
    await redis.emit('ready');
    expect(redis.flushdb).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('❌ Error flushing cache: Flush Error');
  });
});
