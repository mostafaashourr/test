import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CORSConfigService {
  constructor(private configService: ConfigService) {}

  getAllowedOrigins(): string[] {
    return this.configService.get<string>('ALLOWED_ORIGINS')?.split(',') || [];
  }
}
