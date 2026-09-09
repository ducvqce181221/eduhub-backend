import { describe, it, expect, vi } from "vitest";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { of, lastValueFrom } from "rxjs";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";

describe("Phase 10 - Cụm 2: API Quality Envelopes (TDD)", () => {
  describe("1. TransformInterceptor - Standard Response Envelope [05_API_Design §1.1]", () => {
    const interceptor = new TransformInterceptor();

    const createMockExecutionContext = (): ExecutionContext => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({ url: "/api/v1/test" }),
          getResponse: () => ({}),
        }),
      } as unknown as ExecutionContext;
    };

    it("should wrap a single resource object into { success: true, data: { ... } }", async () => {
      const mockData = { id: "uuid-1", title: "NestJS Mastery" };
      const callHandler: CallHandler = {
        handle: () => of(mockData),
      };

      const result$ = interceptor.intercept(createMockExecutionContext(), callHandler);
      const response = await lastValueFrom(result$);

      expect(response).toEqual({
        success: true,
        data: mockData,
      });
    });

    it("should wrap paginated result { data: [...], meta: { ... } } into { success: true, data: [...], meta: { ... } }", async () => {
      const mockPaginated = {
        data: [{ id: "1" }, { id: "2" }],
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      };
      const callHandler: CallHandler = {
        handle: () => of(mockPaginated),
      };

      const result$ = interceptor.intercept(createMockExecutionContext(), callHandler);
      const response = await lastValueFrom(result$);

      expect(response).toEqual({
        success: true,
        data: mockPaginated.data,
        meta: mockPaginated.meta,
      });
    });

    it("should not double-wrap an already enveloped response { success, data, meta? }", async () => {
      const alreadyEnveloped = {
        success: true,
        data: { count: 5 },
        meta: { timestamp: "2026-09-01" },
      };
      const callHandler: CallHandler = {
        handle: () => of(alreadyEnveloped),
      };

      const result$ = interceptor.intercept(createMockExecutionContext(), callHandler);
      const response = await lastValueFrom(result$);

      expect(response).toEqual(alreadyEnveloped);
    });

    it("should wrap null or undefined return into { success: true, data: null }", async () => {
      const callHandlerNull: CallHandler = {
        handle: () => of(null),
      };
      const responseNull = await lastValueFrom(
        interceptor.intercept(createMockExecutionContext(), callHandlerNull),
      );
      expect(responseNull).toEqual({
        success: true,
        data: null,
      });

      const callHandlerUndefined: CallHandler = {
        handle: () => of(undefined),
      };
      const responseUndefined = await lastValueFrom(
        interceptor.intercept(createMockExecutionContext(), callHandlerUndefined),
      );
      expect(responseUndefined).toEqual({
        success: true,
        data: null,
      });
    });

    it("should wrap primitive data types (string, number, boolean)", async () => {
      const callHandlerStr: CallHandler = {
        handle: () => of("pong"),
      };
      const responseStr = await lastValueFrom(
        interceptor.intercept(createMockExecutionContext(), callHandlerStr),
      );
      expect(responseStr).toEqual({
        success: true,
        data: "pong",
      });

      const callHandlerNum: CallHandler = {
        handle: () => of(100),
      };
      const responseNum = await lastValueFrom(
        interceptor.intercept(createMockExecutionContext(), callHandlerNum),
      );
      expect(responseNum).toEqual({
        success: true,
        data: 100,
      });
    });
  });

  describe("2. HttpExceptionFilter - Standard Error Envelope [05_API_Design §1.1 & §3]", () => {
    const filter = new HttpExceptionFilter();

    const createMockHost = (url: string = "/api/v1/test") => {
      const statusFn = vi.fn().mockReturnThis();
      const jsonFn = vi.fn().mockReturnThis();

      const response = {
        status: statusFn,
        json: jsonFn,
      };

      const request = {
        url,
        method: "POST",
      };

      const host = {
        switchToHttp: () => ({
          getResponse: () => response,
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext;

      return { host, statusFn, jsonFn, response, request };
    };

    it("should format BadRequestException with array of messages (validation error)", () => {
      const { host, statusFn, jsonFn } = createMockHost("/api/v1/auth/register");
      const validationError = new BadRequestException([
        "email must be an email",
        "password is too short",
      ]);

      filter.catch(validationError, host as any);

      expect(statusFn).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 400,
          message: ["email must be an email", "password is too short"],
          error: "Bad Request",
          path: "/api/v1/auth/register",
          timestamp: expect.any(String),
        }),
      );
    });

    it("should format BadRequestException with single string message", () => {
      const { host, statusFn, jsonFn } = createMockHost("/api/v1/courses/1/chapters");
      const error = new BadRequestException("Chapter order must be positive");

      filter.catch(error, host as any);

      expect(statusFn).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 400,
          message: ["Chapter order must be positive"],
          error: "Bad Request",
          path: "/api/v1/courses/1/chapters",
          timestamp: expect.any(String),
        }),
      );
    });

    it("should format NotFoundException", () => {
      const { host, statusFn, jsonFn } = createMockHost("/api/v1/courses/uuid-not-found");
      const error = new NotFoundException("Course not found");

      filter.catch(error, host as any);

      expect(statusFn).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 404,
          message: ["Course not found"],
          error: "Not Found",
          path: "/api/v1/courses/uuid-not-found",
          timestamp: expect.any(String),
        }),
      );
    });

    it("should format ForbiddenException", () => {
      const { host, statusFn, jsonFn } = createMockHost("/api/v1/courses/uuid-other/publish");
      const error = new ForbiddenException("You do not own this course");

      filter.catch(error, host as any);

      expect(statusFn).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 403,
          message: ["You do not own this course"],
          error: "Forbidden",
          path: "/api/v1/courses/uuid-other/publish",
          timestamp: expect.any(String),
        }),
      );
    });

    it("should format ConflictException", () => {
      const { host, statusFn, jsonFn } = createMockHost("/api/v1/categories/cat-1");
      const error = new ConflictException("Category has active courses attached");

      filter.catch(error, host as any);

      expect(statusFn).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 409,
          message: ["Category has active courses attached"],
          error: "Conflict",
          path: "/api/v1/categories/cat-1",
          timestamp: expect.any(String),
        }),
      );
    });

    it("should format UnprocessableEntityException (Publish Checklist failure)", () => {
      const { host, statusFn, jsonFn } = createMockHost("/api/v1/courses/course-1/publish");
      const checklistErrors = [
        "Course must contain at least 1 chapter",
        "Every lesson must have an attached video",
      ];
      const error = new UnprocessableEntityException(checklistErrors);

      filter.catch(error, host as any);

      expect(statusFn).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 422,
          message: checklistErrors,
          error: "Unprocessable Entity",
          path: "/api/v1/courses/course-1/publish",
          timestamp: expect.any(String),
        }),
      );
    });

    it("should format unhandled generic Error as 500 Internal Server Error without leaking internal stack", () => {
      const { host, statusFn, jsonFn } = createMockHost("/api/v1/critical-operation");
      const unhandledError = new Error("Database connection dropped unexpectedly");

      filter.catch(unhandledError, host as any);

      expect(statusFn).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 500,
          message: ["Internal server error"],
          error: "Internal Server Error",
          path: "/api/v1/critical-operation",
          timestamp: expect.any(String),
        }),
      );
    });
  });
});
