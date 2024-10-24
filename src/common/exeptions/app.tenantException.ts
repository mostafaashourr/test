import { HttpException, HttpStatus } from '@nestjs/common';

export class TenantException extends HttpException {
  constructor(
    private readonly customMessage: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        message: customMessage,
        statusCode: status,
      },
      status,
    );
  }
}
