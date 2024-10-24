import { RequestInterceptor } from './request.interceptor';
import { MultiTenantConfig } from '../config/multi-tenant.config';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { Constants } from '../common/constants/app.constants';
import { ConfigService } from '@nestjs/config';

describe('RequestInterceptor', () => {
    let interceptor: RequestInterceptor;
    let multiTenantConfig: MultiTenantConfig;

    beforeEach(() => {
        multiTenantConfig = new MultiTenantConfig(new ConfigService());
        interceptor = new RequestInterceptor(multiTenantConfig);
    });

    it('should modify the request body with tenant and constant values', (done) => {
        const tenantConfigMock = { appId: 'testAppId' } as any;
        jest.spyOn(multiTenantConfig, 'getConfig').mockReturnValue(tenantConfigMock);

        const requestMock = {
            body: {},
        } as any;
        const contextMock = {
            switchToHttp: () => ({
                getRequest: () => requestMock,
            }),
        } as unknown as ExecutionContext;

        const callHandlerMock: Partial<CallHandler> = {
            handle: () => of({ data: 'test data' }),
        };

        interceptor.intercept(contextMock, callHandlerMock as CallHandler).subscribe((result) => {
            expect(result).toEqual({ data: 'test data' });
            expect(requestMock.body).toEqual({
                id: Constants.ID,
                appId: tenantConfigMock.appId,
                txnId: Constants.TXN_ID,
                action: Constants.ACTION,
                isUser: Constants.IS_USER,
                isTobi: Constants.IS_TOBI,
                isAgent: Constants.IS_AGENT,
                messageSent: Constants.MESSAGE_SENT,
            });

            expect(multiTenantConfig.getConfig).toHaveBeenCalledWith(requestMock);
            done();
        });
    });
});
