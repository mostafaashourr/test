import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Constants } from '../common/constants/app.constants';
import { Request } from 'express';


interface TenantConfigType {
  postMessageUrl: string;
  appId: string;
  accessTokenUrl: string;
  clientCredentials: string;
}

@Injectable()
export class MultiTenantConfig {
  
  public getCurrentTenant(req: Request): string {
    return req.headers[Constants.X_TENANT_HEADER] as string;
  }

  constructor(private readonly configService: ConfigService) { }

  /**
   * Retrieves the configuration for the specified tenant.
   * @param tenant Tenant enum value (e.g., 'PT' or 'GE').
   * @returns TenantConfigType configuration object.
   */
  public getConfig(req: Request): TenantConfigType {
    const tenantValue = req.headers[Constants.X_TENANT_HEADER] as string;
    const tenantValueCap = tenantValue.toUpperCase();
    const config: TenantConfigType = {
      postMessageUrl: this.configService.get<string>(`TOBI_${tenantValueCap}_POST_MESSAGE_URL`),
      appId: this.configService.get<string>(`TOBI_${tenantValueCap}_APP_ID`),
      accessTokenUrl: this.configService.get<string>(`TOBI_${tenantValueCap}_ACCESS_TOKEN_URL`),
      clientCredentials: this.configService.get<string>(`TOBI_${tenantValueCap}_CLIENT_CREDENTIALS`),
    }
    return config;
  }
}
