import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { createPrismaClient } from "../src/lib/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import { AuthService } from "../src/auth/auth.service";
import { TokenService } from "../src/auth/token.service";
import { PasswordService } from "../src/auth/password.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

describe("Phase 12 - Google OAuth2 Authentication (TDD: Red)", () => {
  let prisma: PrismaClient;
  let authService: AuthService;
  let tokenService: TokenService;
  let passwordService: PasswordService;

  const timestamp = Date.now();
  const mockConfigService = {
    get: (key: string, defaultValue?: any) => {
      if (key === "JWT_ACCESS_SECRET") return "test-access-secret-123456789012";
      if (key === "JWT_REFRESH_SECRET") return "test-refresh-secret-123456789012";
      if (key === "JWT_ACCESS_EXPIRES_IN") return "15m";
      if (key === "JWT_REFRESH_EXPIRES_IN") return "7d";
      return defaultValue;
    },
  } as unknown as ConfigService;

  beforeAll(async () => {
    prisma = createPrismaClient();
    await prisma.$connect();

    const jwtService = new JwtService({});
    tokenService = new TokenService(jwtService, mockConfigService);
    passwordService = new PasswordService();

    authService = new AuthService(
      prisma as any,
      passwordService,
      tokenService,
      mockConfigService,
    );
  });

  afterAll(async () => {
    // Cleanup created test users
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: `google.test.${timestamp}`,
        },
      },
    });
    await prisma.$disconnect();
  });

  describe("Google User Validation & Account Provisioning", () => {
    it("should provision a new student account when signing in with Google for the first time [BR-USR-01, BR-USR-04]", async () => {
      const googleProfile = {
        id: `google-sub-new-${timestamp}`,
        emails: [{ value: `  Student.Google.${timestamp}@EduHub.dev  ` }],
        displayName: "Google New Student",
        photos: [{ value: "https://lh3.googleusercontent.com/avatar-new.jpg" }],
      };

      const result = await authService.validateGoogleUser(googleProfile);

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(`student.google.${timestamp}@eduhub.dev`);
      expect(result.user.role).toBe("STUDENT"); // Strictly STUDENT per BR-USR-01
      expect(result.user.googleId).toBe(googleProfile.id);
      expect(result.user.fullName).toBe("Google New Student");
      expect(result.user.passwordHash).toBeNull();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it("should login an existing user matching googleId directly", async () => {
      const googleId = `google-sub-existing-${timestamp}`;
      const email = `existing.google.${timestamp}@eduhub.dev`;

      await prisma.user.create({
        data: {
          email,
          googleId,
          fullName: "Existing Google User",
          role: "STUDENT",
          isActive: true,
          passwordHash: null,
        },
      });

      const googleProfile = {
        id: googleId,
        emails: [{ value: email }],
        displayName: "Existing Google User",
      };

      const result = await authService.validateGoogleUser(googleProfile);

      expect(result.user.email).toBe(email);
      expect(result.user.googleId).toBe(googleId);
      expect(result.accessToken).toBeDefined();
    });

    it("should link googleId to an existing email-registered account on verified Google login", async () => {
      const email = `link.account.${timestamp}@eduhub.dev`;
      const passwordHash = await passwordService.hashPassword("SecurePass123");

      const existingLocalUser = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: "Local Registered User",
          role: "STUDENT",
          isActive: true,
        },
      });

      const newGoogleId = `google-link-id-${timestamp}`;
      const googleProfile = {
        id: newGoogleId,
        emails: [{ value: email.toUpperCase() }], // Test normalization
        displayName: "Local Registered User",
      };

      const result = await authService.validateGoogleUser(googleProfile);

      expect(result.user.id).toBe(existingLocalUser.id);
      expect(result.user.googleId).toBe(newGoogleId);

      // Verify in DB that googleId was saved
      const updatedUser = await prisma.user.findUnique({
        where: { id: existingLocalUser.id },
      });
      expect(updatedUser?.googleId).toBe(newGoogleId);
    });

    it("should reject Google login if account has been deactivated [BR-USR-03]", async () => {
      const googleId = `google-disabled-${timestamp}`;
      const email = `disabled.google.${timestamp}@eduhub.dev`;

      await prisma.user.create({
        data: {
          email,
          googleId,
          fullName: "Deactivated Google User",
          role: "STUDENT",
          isActive: false, // Inactive user
          passwordHash: null,
        },
      });

      const googleProfile = {
        id: googleId,
        emails: [{ value: email }],
        displayName: "Deactivated Google User",
      };

      await expect(
        authService.validateGoogleUser(googleProfile),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("Password Login Protection for Google-Only Accounts", () => {
    it("should throw UnauthorizedException when attempting password login on an account created via Google", async () => {
      const email = `google.only.${timestamp}@eduhub.dev`;

      await prisma.user.create({
        data: {
          email,
          googleId: `google-only-${timestamp}`,
          fullName: "Google Only User",
          role: "STUDENT",
          isActive: true,
          passwordHash: null,
        },
      });

      await expect(
        authService.login({
          email,
          password: "SomePassword123",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("AuthController Google OAuth Endpoints", () => {
    it("should handle googleAuthCallback, set refresh cookie, and return token envelope", async () => {
      const { AuthController } = await import("../src/auth/auth.controller");
      const controller = new AuthController(authService);

      const googleProfile = {
        id: `google-cb-${timestamp}`,
        emails: [{ value: `cb.student.${timestamp}@eduhub.dev` }],
        displayName: "Callback Student",
      };

      const mockReq: any = { user: googleProfile };
      const cookieMock = vi.fn();
      const mockRes: any = { cookie: cookieMock };

      const result = await controller.googleAuthCallback(mockReq, mockRes);

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe(`cb.student.${timestamp}@eduhub.dev`);
      expect(cookieMock).toHaveBeenCalledWith(
        "refreshToken",
        result.refreshToken,
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it("should handle googleTokenAuth from frontend credential, set refresh cookie, and return tokens", async () => {
      const { AuthController } = await import("../src/auth/auth.controller");
      const controller = new AuthController(authService);

      const cookieMock = vi.fn();
      const mockRes: any = { cookie: cookieMock };

      const result = await controller.googleTokenAuth(
        {
          googleId: `google-token-${timestamp}`,
          email: `token.student.${timestamp}@eduhub.dev`,
          fullName: "Token Student",
          avatarUrl: "https://avatar.google.com/token-student.png",
        },
        mockRes,
      );

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe(`token.student.${timestamp}@eduhub.dev`);
      expect(result.user.avatarUrl).toBe("https://avatar.google.com/token-student.png");
      expect(cookieMock).toHaveBeenCalled();
    });
  });
});

