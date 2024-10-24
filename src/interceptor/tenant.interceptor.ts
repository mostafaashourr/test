import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; 
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Constants } from '../common/constants/app.constants';
import { TenantException } from '../common/exeptions/app.tenantException';

@Injectable()
export class TenantHeaderInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantHeaderInterceptor.name);
  private readonly tenants: string[];

  constructor(private readonly configService: ConfigService) {
    this.tenants = this.loadTenantsFromConfig();
  }

  private loadTenantsFromConfig(): string[] {
    const tenantsConfig = this.configService.get<string>('TOPI_TENANTS');
    return tenantsConfig ? tenantsConfig.split(',') : [];
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers } = request;
    const tenantHeader = headers[Constants.X_TENANT_HEADER.toLowerCase()];

    this.validateTenantHeader(tenantHeader);

    const logMessage = `Record[tenant='${tenantHeader}', httpMethod='${method}', inboundRequestUri='${url}', timestamp='${new Date().toISOString()}']`;
    this.logger.log(logMessage);

    const start = Date.now();
    return next.handle().pipe(
      tap(() => this.logger.log(`Response for: ${method} ${url} - ${Date.now() - start}ms`)),
    );
  }

  private validateTenantHeader(tenant: string): void {
    if (!tenant) {
      throw new TenantException('Missing x-tenant header');
    }

    if (!this.tenants.includes(tenant)) {
      throw new TenantException(`Invalid tenant: ${tenant}. Supported tenants are: ${this.tenants.join(', ')}`);
    }
  }
}
