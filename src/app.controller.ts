import { Controller, Get, Post, Req, Res, UseInterceptors } from '@nestjs/common';
import { AppService } from './app.service';
import { Request, Response } from 'express';
import { TenantHeaderInterceptor } from './interceptor/tenant.interceptor';
import { RequestInterceptor } from './interceptor/request.interceptor';


@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {
  }

  
  @Get('/status')
  async getStatus(@Res() res: Response) {
    res.json({ Message: 'Server is up and running' });
  }


  @Post('/message')
  @UseInterceptors(TenantHeaderInterceptor, RequestInterceptor)
  async sendEvent(@Req() req: Request) {
    return await this.appService.message(req);
  }
}
