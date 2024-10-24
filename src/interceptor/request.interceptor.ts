import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Constants } from '../common/constants/app.constants';
import { MultiTenantConfig } from '../config/multi-tenant.config';

@Injectable()
export class RequestInterceptor implements NestInterceptor {
    constructor(private readonly multiTenantConfig: MultiTenantConfig) { }
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const tenantConfig = this.multiTenantConfig.getConfig(request);
        
        request.body = {
            ...request.body,
            id: Constants.ID,
            appId: tenantConfig.appId,
            txnId: Constants.TXN_ID,
            action: Constants.ACTION,
            isUser: Constants.IS_USER,
            isTobi: Constants.IS_TOBI,
            isAgent: Constants.IS_AGENT,
            messageSent: Constants.MESSAGE_SENT,
        };
        return next.handle().pipe(
            map((data) => {
                return data;
            }),
        );
    }
}
