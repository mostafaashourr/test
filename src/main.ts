import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { CORSConfigService } from './cors/cors-config.service'; // Import the service
import { ValidationPipe } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import logger from './utils/logger';

export async function bootstrap() {

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  // Get the ConfigService and CORSConfigService from the application context
  const configService = app.get(ConfigService);
  const corsConfigService = app.get(CORSConfigService);
  // Add Logger
  const loggerInstance = logger({
    logLevel: configService.get('LOG_LEVEL') || 'info',
    logPath: configService.get('LOG_PATH') || 'logs',
    logFileName: configService.get('LOG_FILE_NAME') || 'tobi-supersearch-middleware',
  });

  app.useLogger(
    WinstonModule.createLogger({
      instance: loggerInstance,
    }),
  );


  const allowedOrigins = corsConfigService.getAllowedOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.some(allowedOrigin => origin.endsWith(allowedOrigin.trim())) || origin === 'null') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);

  loggerInstance.info(`Application is running on: http://localhost:${port}`);
}

bootstrap().catch(err => {

  console.error('Error starting the application:', err);
  process.exit(1);
});
