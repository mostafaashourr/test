import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CORSConfigService } from './cors-config.service';

@Module({
  imports: [ConfigModule],
  providers: [CORSConfigService],
  exports: [CORSConfigService],
})
export class CORSConfigModule {
}
