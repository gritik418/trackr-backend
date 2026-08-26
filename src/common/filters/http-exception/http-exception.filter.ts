import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter<T> implements ExceptionFilter {
  catch(exception: T, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any).message || 'Internal server error'
        : 'Internal server error';

    const errors =
      exception instanceof HttpException
        ? (exception.getResponse() as any).errors || null
        : null;

    response.status(status).json({
      success: false,
      message,
      ...(errors && { errors }),
    });
  }
}
