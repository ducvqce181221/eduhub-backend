import { describe, it, expect, beforeEach, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { ExecutionContext } from "@nestjs/common";
import { PasswordService } from "../src/auth/password.service";
import { TokenService } from "../src/auth/token.service";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("Phase 3 - Part 1: Auth Core Services & Guards", () => {
  // -------------------------------------------------------------
  // 1. PasswordService Test Suite
  // -------------------------------------------------------------
  describe("PasswordService", () => {
    let passwordService: PasswordService;

    beforeEach(() => {
      passwordService = new PasswordService();
    });

    it("should successfully hash password using bcryptjs with salt rounds >= 10", async () => {
      const plainPassword = "Password123!";
      const hash = await passwordService.hashPassword(plainPassword);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash).not.toBe(plainPassword);
      expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
    });

    it("should return true when comparing valid password with its hash", async () => {
      const plainPassword = "Password123!";
      const hash = await passwordService.hashPassword(plainPassword);

      const isValid = await passwordService.comparePassword(plainPassword, hash);
      expect(isValid).toBe(true);
    });

    it("should return false when comparing incorrect password with hash", async () => {
      const plainPassword = "Password123!";
      const hash = await passwordService.hashPassword(plainPassword);

      const isValid = await passwordService.comparePassword("WrongPassword123!", hash);
      expect(isValid).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 2. TokenService Test Suite
  // -------------------------------------------------------------
  describe("TokenService", () => {
    let tokenService: TokenService;
    let configService: ConfigService;
    let jwtService: JwtService;

    beforeEach(() => {
      jwtService = new JwtService();
      configService = new ConfigService({
        JWT_ACCESS_SECRET: "test-access-secret-12345",
        JWT_REFRESH_SECRET: "test-refresh-secret-67890",
        JWT_ACCESS_EXPIRES_IN: "15m",
        JWT_REFRESH_EXPIRES_IN: "7d",
      });
      tokenService = new TokenService(jwtService, configService);
    });

    it("should generate valid Access Token containing sub, email, and role", () => {
      const payload = {
        sub: "user-uuid-123",
        email: "student@eduhub.dev",
        role: "STUDENT",
      };

      const token = tokenService.generateAccessToken(payload);
      expect(token).toBeDefined();
      expect(token.split(".").length).toBe(3);

      const decoded = tokenService.verifyAccessToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it("should generate valid Refresh Token containing sub, email, and role", () => {
      const payload = {
        sub: "user-uuid-456",
        email: "teacher@eduhub.dev",
        role: "TEACHER",
      };

      const token = tokenService.generateRefreshToken(payload);
      expect(token).toBeDefined();
      expect(token.split(".").length).toBe(3);

      const decoded = tokenService.verifyRefreshToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it("should generate valid Password Reset Token containing sub and email", () => {
      const payload = {
        sub: "user-uuid-789",
        email: "admin@eduhub.dev",
      };

      const token = tokenService.generatePasswordResetToken(payload);
      expect(token).toBeDefined();

      const decoded = tokenService.verifyPasswordResetToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
    });

    it("should throw UnauthorizedException when verifying tampered or invalid access token", () => {
      expect(() => tokenService.verifyAccessToken("invalid.tampered.token")).toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when verifying access token with wrong secret (e.g. Refresh Token)", () => {
      const payload = { sub: "1", email: "a@b.com", role: "STUDENT" };
      const refreshToken = tokenService.generateRefreshToken(payload);

      expect(() => tokenService.verifyAccessToken(refreshToken)).toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when verifying expired access token", () => {
      const expiredToken = jwtService.sign(
        { sub: "1", email: "a@b.com", role: "STUDENT" },
        { secret: "test-access-secret-12345", expiresIn: "-1s" },
      );

      expect(() => tokenService.verifyAccessToken(expiredToken)).toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when verifying tampered or expired refresh token", () => {
      expect(() => tokenService.verifyRefreshToken("tampered.refresh.token")).toThrow(
        UnauthorizedException,
      );

      const expiredRefreshToken = jwtService.sign(
        { sub: "1", email: "a@b.com", role: "STUDENT" },
        { secret: "test-refresh-secret-67890", expiresIn: "-1s" },
      );
      expect(() => tokenService.verifyRefreshToken(expiredRefreshToken)).toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when verifying tampered or expired password reset token", () => {
      expect(() => tokenService.verifyPasswordResetToken("tampered.reset.token")).toThrow(
        UnauthorizedException,
      );

      const expiredResetToken = jwtService.sign(
        { sub: "1", email: "a@b.com" },
        { secret: "test-access-secret-12345", expiresIn: "-1s" },
      );
      expect(() => tokenService.verifyPasswordResetToken(expiredResetToken)).toThrow(
        UnauthorizedException,
      );
    });
  });

  // -------------------------------------------------------------
  // 3. JwtAuthGuard Test Suite
  // -------------------------------------------------------------
  describe("JwtAuthGuard", () => {
    let guard: JwtAuthGuard;
    let tokenService: TokenService;
    let jwtService: JwtService;
    let prismaServiceMock: Partial<PrismaService>;

    const createMockExecutionContext = (authHeader?: string): { context: ExecutionContext; req: any } => {
      const req: any = {
        headers: authHeader ? { authorization: authHeader } : {},
      };
      const context = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as unknown as ExecutionContext;

      return { context, req };
    };

    beforeEach(() => {
      jwtService = new JwtService();
      const configService = new ConfigService({
        JWT_ACCESS_SECRET: "test-access-secret-12345",
        JWT_REFRESH_SECRET: "test-refresh-secret-67890",
        JWT_ACCESS_EXPIRES_IN: "15m",
        JWT_REFRESH_EXPIRES_IN: "7d",
      });
      tokenService = new TokenService(jwtService, configService);

      prismaServiceMock = {
        user: {
          findUnique: vi.fn(),
        } as any,
      };

      guard = new JwtAuthGuard(tokenService, prismaServiceMock as PrismaService);
    });

    it("should allow request and attach req.user when valid Bearer token provided for active user", async () => {
      const payload = { sub: "user-1", email: "alice@eduhub.dev", role: "STUDENT" };
      const token = tokenService.generateAccessToken(payload);

      (prismaServiceMock.user!.findUnique as any).mockResolvedValue({
        id: "user-1",
        email: "alice@eduhub.dev",
        role: "STUDENT",
        isActive: true,
      });

      const { context, req } = createMockExecutionContext(`Bearer ${token}`);
      const canActivate = await guard.canActivate(context);

      expect(canActivate).toBe(true);
      expect(req.user).toEqual({
        id: "user-1",
        email: "alice@eduhub.dev",
        role: "STUDENT",
      });
    });

    it("should support case-insensitive bearer prefix (e.g. bearer <token>)", async () => {
      const payload = { sub: "user-1", email: "alice@eduhub.dev", role: "STUDENT" };
      const token = tokenService.generateAccessToken(payload);

      (prismaServiceMock.user!.findUnique as any).mockResolvedValue({
        id: "user-1",
        email: "alice@eduhub.dev",
        role: "STUDENT",
        isActive: true,
      });

      const { context, req } = createMockExecutionContext(`bearer ${token}`);
      const canActivate = await guard.canActivate(context);

      expect(canActivate).toBe(true);
      expect(req.user).toBeDefined();
    });

    it("should throw UnauthorizedException when Authorization header is missing", async () => {
      const { context } = createMockExecutionContext(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when Authorization header is empty or malformed", async () => {
      const { context: ctx1 } = createMockExecutionContext("Basic dXNlcjpwYXNz");
      await expect(guard.canActivate(ctx1)).rejects.toThrow(UnauthorizedException);

      const { context: ctx2 } = createMockExecutionContext("Bearer ");
      await expect(guard.canActivate(ctx2)).rejects.toThrow(UnauthorizedException);

      const { context: ctx3 } = createMockExecutionContext("Bearer       ");
      await expect(guard.canActivate(ctx3)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when token signature is invalid", async () => {
      const { context } = createMockExecutionContext("Bearer invalid.token.string");

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when token is expired", async () => {
      const expiredToken = jwtService.sign(
        { sub: "user-1", email: "alice@eduhub.dev", role: "STUDENT" },
        { secret: "test-access-secret-12345", expiresIn: "-1s" },
      );

      const { context } = createMockExecutionContext(`Bearer ${expiredToken}`);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when user account is deactivated (BR-USR-03)", async () => {
      const payload = { sub: "user-disabled", email: "blocked@eduhub.dev", role: "STUDENT" };
      const token = tokenService.generateAccessToken(payload);

      (prismaServiceMock.user!.findUnique as any).mockResolvedValue({
        id: "user-disabled",
        email: "blocked@eduhub.dev",
        role: "STUDENT",
        isActive: false, // Deactivated by admin
      });

      const { context } = createMockExecutionContext(`Bearer ${token}`);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when user does not exist in database", async () => {
      const payload = { sub: "user-deleted", email: "ghost@eduhub.dev", role: "STUDENT" };
      const token = tokenService.generateAccessToken(payload);

      (prismaServiceMock.user!.findUnique as any).mockResolvedValue(null);

      const { context } = createMockExecutionContext(`Bearer ${token}`);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});
