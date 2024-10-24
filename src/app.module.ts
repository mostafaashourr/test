import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MiddlewareModule } from './middleware/middleware.module';
import { CORSConfigModule } from './cors/cors.module'; // Redis providers
import { MultiTenantConfig } from './config/multi-tenant.config';

@Module({
  imports: [ CORSConfigModule,
    ConfigModule.forRoot({
      isGlobal: true, // Make environment variables available globally
    }), // Load environment variables
    HttpModule, // For making HTTP requests
    MiddlewareModule, // Redis and middleware related providers
  ],
  controllers: [AppController],
  providers: [
    AppService,
    MultiTenantConfig,
  ],
})
export class AppModule {}
