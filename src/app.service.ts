import { HttpException, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { AxiosError } from 'axios';
import { catchError, firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { Constants } from './common/constants/app.constants';
import * as jwt from 'jsonwebtoken';
import { MultiTenantConfig } from './config/multi-tenant.config';

@Injectable()
export class AppService {
  webPlatformTokens: Record<string, string> = {};
  private numberOfRetry: number = 0;
  private readonly maxNumberOfRetries: number = 1;

  constructor(
    private readonly httpService: HttpService,
    private readonly multiTenantConfig: MultiTenantConfig,
  ) { }

  getWebPlatformToken(req: Request): string {
    return this.webPlatformTokens[this.multiTenantConfig.getCurrentTenant(req)];
  }

  isTokenValid(req: Request): boolean {
    const webPlatformToken = this.getWebPlatformToken(req);
    if (!webPlatformToken) return false;

    const decodedToken: any = jwt.decode(webPlatformToken);
    if (!decodedToken?.exp) return false;

    const currentTime = Math.floor(Date.now() / 1000);
    return decodedToken.exp - 5 > currentTime;
  }

  async getToken(req: Request) {
    const tenantConfig = this.multiTenantConfig.getConfig(req);
    if (this.isTokenValid(req)) return this.getWebPlatformToken(req);
    const accessTokenUrl = new URL(tenantConfig.accessTokenUrl);
    accessTokenUrl.searchParams.append('grant_type', 'client_credentials');
    const { data } = await firstValueFrom(
      this.httpService
        .post(
          accessTokenUrl.toString(),
          {},
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Accept: 'application/json',
              Authorization: tenantConfig.clientCredentials,
            },
          },
        )
        .pipe(
          catchError((error: AxiosError) => {
            Logger.log(error);
            throw new HttpException(error.response.data, error.response.status);
          }),
        ),
    );

    this.webPlatformTokens[this.multiTenantConfig.getCurrentTenant(req)] = data.access_token;
    return this.getWebPlatformToken(req);
  }

  async addRequestCookies(req: Request) {
    const token = await this.getToken(req);
    const cookies = req.headers.cookie || '';
    const cookieObj: Record<string, string> = {};

    cookies.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const key = parts[0]?.trim();
      const value = parts[1]?.trim();

      if (key) {
        cookieObj[key] = value || '';
      }
    });

    cookieObj[Constants.WEB_PLATFORMS_TOKEN] = String(token);

    const updatedCookies = Object.entries(cookieObj)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');

    req.headers.cookie = updatedCookies;
    return req;
  }

  async message(req: Request) {
    const tenantConfig = this.multiTenantConfig.getConfig(req);
    const token = await this.getToken(req);
    const accessTokenUrl = new URL(tenantConfig.postMessageUrl);
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(accessTokenUrl.toString(), req.body, {
          headers: {
            Accept: 'application/json',
            Authorization: token,
          },
        }),
      );
      return data;
    } catch (error) {
      if (this.numberOfRetry < this.maxNumberOfRetries) {
        this.numberOfRetry += 1;
        return this.message(req);
      } else {
        Logger.warn('Exceed the number of allowed retries');
        Logger.log(error);
        throw new HttpException(error.response.data, error.response.status);
      }
    }
  }
}