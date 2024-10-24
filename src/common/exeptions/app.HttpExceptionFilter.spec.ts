// http-exception-filter.spec.ts
import { ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpExceptionFilter } from './app.HttpExceptionFilter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let exception: HttpException;
  let host: ArgumentsHost;
  let responseMock: Response;
  let requestMock: Request;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    exception = new HttpException('Test Exception', 400);
    responseMock = {
      status: jest.fn(() => ({ json: jest.fn() })),
      json: jest.fn(),
    } as any;
    requestMock = {
      url: '/test-path',
    } as any;
    host = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(responseMock),
        getRequest: jest.fn().mockReturnValue(requestMock),
      }),
    } as any;
  });

  it('should return correct response', () => {
    filter.catch(exception, host);

    expect(responseMock.status).toHaveBeenCalledWith(400);
  });
});
