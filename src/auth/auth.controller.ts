import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Optional,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RateLimitGuard } from "./guards/rate-limit.guard";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { GoogleAuthDto } from "./dto/google-auth.dto";
import { CurrentUser } from "./decorators/current-user.decorator";
import { RateLimit } from "./decorators/rate-limit.decorator";
import type { AuthenticatedUser } from "./guards/jwt-auth.guard";
import { TurnstileService } from "./turnstile.service";

const REFRESH_COOKIE_NAME = "refreshToken";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@ApiTags("Authentication & Profile")
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Optional()
    @Inject(ConfigService)
    private readonly configService?: ConfigService,
    @Inject(TurnstileService)
    private readonly turnstileService?: TurnstileService,
  ) {}

  @Post("register")
  @UseGuards(RateLimitGuard)
  @RateLimit(5, 60)
  @ApiOperation({ summary: "Register a new student account (Public)" })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: "Student registered successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Validation failure (weak password, invalid email)",
  })
  @ApiResponse({
    status: 409,
    description: "Email already exists",
  })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    if (this.turnstileService) {
      await this.turnstileService.verifyToken(dto.turnstileToken, req?.ip, "signup");
    }
    return this.authService.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit(5, 60)
  @ApiOperation({ summary: "Login with email & password (Public)" })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: "User authenticated; returns access & refresh tokens and sets httpOnly cookie",
  })
  @ApiResponse({
    status: 401,
    description: "Invalid credentials or account disabled",
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    if (this.turnstileService) {
      await this.turnstileService.verifyToken(dto.turnstileToken, req?.ip, "login");
    }
    const result = await this.authService.login(dto);
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
    return result;
  }

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: "Initiate Google OAuth2 authentication (Public)" })
  @ApiResponse({
    status: 302,
    description: "Redirects to Google Accounts for consent",
  })
  async googleAuth() {
    // Handled automatically by Passport Google strategy
  }

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: "Google OAuth2 callback URL (Public)" })
  @ApiResponse({
    status: 302,
    description: "Google authenticated; redirects to frontend auth callback",
  })
  async googleAuthCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const profile = (req as any).user;
    const result = await this.authService.validateGoogleUser(profile);
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);

    const frontendUrl =
      this.configService?.get<string>("FRONTEND_URL") ||
      process.env.FRONTEND_URL ||
      "http://localhost:3000";

    const state = (req.query?.state as string) || "";
    let returnUrl = "/courses";
    if (state) {
      try {
        const parsed = JSON.parse(
          Buffer.from(state, "base64").toString("utf-8"),
        );
        if (parsed?.returnUrl) {
          returnUrl = parsed.returnUrl;
        }
      } catch {
        // default to /courses
      }
    }

    if (typeof (res as any).redirect === "function") {
      (res as any).redirect(
        `${frontendUrl}/auth/callback?returnUrl=${encodeURIComponent(returnUrl)}`,
      );
      return;
    }

    return result;
  }

  @Post("google")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Authenticate via Google ID token or credentials (Public)",
  })
  @ApiBody({ type: GoogleAuthDto })
  @ApiResponse({
    status: 200,
    description: "Google authenticated; returns JWT pair & sets httpOnly cookie",
  })
  async googleTokenAuth(
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!dto.googleId && !dto.credential && !dto.email) {
      throw new BadRequestException(
        "Google credential, googleId, or email is required",
      );
    }

    const profile = {
      id: dto.googleId || dto.credential || "",
      emails: dto.email ? [{ value: dto.email }] : [],
      displayName: dto.fullName || "",
      photos: dto.avatarUrl ? [{ value: dto.avatarUrl }] : [],
    };

    const result = await this.authService.validateGoogleUser(profile);
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
    return result;
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Issue new access token via refresh token cookie or body" })
  @ApiBody({ type: RefreshTokenDto, required: false })
  @ApiResponse({
    status: 200,
    description: "New tokens issued successfully and cookie rotated",
  })
  @ApiResponse({
    status: 401,
    description: "Invalid or expired refresh token",
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || dto?.refreshToken;
    if (!token) {
      throw new BadRequestException("Refresh token is required");
    }
    const result = await this.authService.refresh({ refreshToken: token });
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
    return result;
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Invalidate session / logout" })
  @ApiResponse({
    status: 200,
    description: "Logged out successfully and cookie cleared",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/api/v1/auth",
    });
    return this.authService.logout();
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Retrieve authenticated user profile" })
  @ApiResponse({
    status: 200,
    description: "Current user profile information",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update personal profile information" })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: "Profile updated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Validation failure",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change current password" })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: "Password changed successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Current password incorrect or new password weak",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit(5, 60)
  @ApiOperation({ summary: "Request password reset token" })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: "Password reset instructions sent",
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    if (this.turnstileService) {
      await this.turnstileService.verifyToken(dto.turnstileToken, req?.ip, "forgot_password");
    }
    return this.authService.forgotPassword(dto);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit(5, 60)
  @ApiOperation({ summary: "Set new password using reset token" })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: "Password reset successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Validation failure (weak new password)",
  })
  @ApiResponse({
    status: 401,
    description: "Invalid or expired reset token",
  })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    if (this.turnstileService) {
      await this.turnstileService.verifyToken(dto.turnstileToken, req?.ip, "reset_password");
    }
    return this.authService.resetPassword(dto);
  }
}
