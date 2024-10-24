import { TenantHeaderInterceptor } from './tenant.interceptor';
import { ConfigService } from '@nestjs/config';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { TenantException } from '../common/exeptions/app.tenantException';
import { Constants } from '../common/constants/app.constants';

describe('TenantHeaderInterceptor', () => {
  let interceptor: TenantHeaderInterceptor;
  let configService: ConfigService;

  beforeEach(() => {
    // Create a mock ConfigService
    configService = new ConfigService();

    // Mock the configuration to return a list of supported tenants
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'TOPI_TENANTS') {
        return 'tenant1,tenant2,tenant3';
      }
      return null;
    });

    // Instantiate the interceptor with the mocked ConfigService
    interceptor = new TenantHeaderInterceptor(configService);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    let mockContext: ExecutionContext;
    let mockCallHandler: CallHandler;

    beforeEach(() => {
      // Mock ExecutionContext to simulate HTTP requests
      mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            url: '/test-url',
            headers: {
              [Constants.X_TENANT_HEADER.toLowerCase()]: 'tenant1',
            },
          }),
        }),
      } as unknown as ExecutionContext;

      // Mock CallHandler to simulate the next.handle() behavior
      mockCallHandler = {
        handle: jest.fn().mockReturnValue(of({})),
      };
    });

    it('should log and pass through if the tenant header is valid', (done) => {
      const loggerSpy = jest.spyOn(interceptor['logger'], 'log');

      // Call the interceptor
      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        // Ensure the log messages are correct
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining("Record[tenant='tenant1'"),
        );
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Response for: GET /test-url -'),
        );

        // Ensure the request continues without errors
        expect(mockCallHandler.handle).toHaveBeenCalled();
        done();
      });
    });

    it('should throw TenantException if the tenant header is missing', () => {
      // Remove the tenant header from the request
      mockContext.switchToHttp().getRequest().headers = {};

      expect(() => interceptor.intercept(mockContext, mockCallHandler)).toThrow(
        new TenantException('Missing x-tenant header'),
      );
    });

    it('should throw TenantException if the tenant header is invalid', () => {
      // Use an invalid tenant value in the header
      mockContext.switchToHttp().getRequest().headers = {
        [Constants.X_TENANT_HEADER.toLowerCase()]: 'invalidTenant',
      };

      expect(() => interceptor.intercept(mockContext, mockCallHandler)).toThrow(
        new TenantException('Invalid tenant: invalidTenant. Supported tenants are: tenant1, tenant2, tenant3'),
      );
    });
  });

  describe('loadTenantsFromConfig', () => {
    it('should load tenants from the configuration service', () => {
      const tenants = interceptor['loadTenantsFromConfig']();
      expect(tenants).toEqual(['tenant1', 'tenant2', 'tenant3']);
    });

    it('should return an empty array if no tenants are configured', () => {
      // Override the mock to return an empty string
      jest.spyOn(configService, 'get').mockReturnValue('');
      const tenants = interceptor['loadTenantsFromConfig']();
      expect(tenants).toEqual([]);
    });
  });

  describe('validateTenantHeader', () => {
    it('should not throw if the tenant is valid', () => {
      expect(() => interceptor['validateTenantHeader']('tenant1')).not.toThrow();
    });

    it('should throw TenantException if the tenant is missing', () => {
      expect(() => interceptor['validateTenantHeader']('')).toThrow(
        new TenantException('Missing x-tenant header'),
      );
    });

    it('should throw TenantException if the tenant is invalid', () => {
      expect(() => interceptor['validateTenantHeader']('invalidTenant')).toThrow(
        new TenantException('Invalid tenant: invalidTenant. Supported tenants are: tenant1, tenant2, tenant3'),
      );
    });
  });
});
