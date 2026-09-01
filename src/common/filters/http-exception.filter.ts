import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal server error";
    let error = "Internal Server Error";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        message = res;
        error = exception.name.replace(/Exception$/, "");
      } else if (typeof res === "object" && res !== null) {
        const responseObj = res as Record<string, any>;
        message = responseObj.message ?? exception.message;
        error = responseObj.error ?? exception.name.replace(/Exception$/, "");
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled Exception on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );
      message = "Internal server error";
    }

    const errorResponse = {
      success: false,
      statusCode,
      message: Array.isArray(message) ? message : [message],
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(errorResponse);
  }
}
