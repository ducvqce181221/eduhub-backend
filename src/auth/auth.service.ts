import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import type { RegisterDto } from "./dto/register.dto";
import type { LoginDto } from "./dto/login.dto";
import type { RefreshTokenDto } from "./dto/refresh-token.dto";
import type { UpdateProfileDto } from "./dto/update-profile.dto";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { ForgotPasswordDto } from "./dto/forgot-password.dto";
import type { ResetPasswordDto } from "./dto/reset-password.dto";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto || !dto.email || !dto.password || !dto.fullName) {
      throw new BadRequestException(
        "Email, password, and fullName are required",
      );
    }

    const email = dto.email.trim().toLowerCase();

    // Check if email already exists [BR-USR-04]
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException("Email already exists");
    }

    // Hash password [BR-USR-05]
    const passwordHash = await this.passwordService.hashPassword(dto.password);

    // Create user with forced STUDENT role [BR-USR-01]
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName.trim(),
        role: "STUDENT",
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async login(dto: LoginDto) {
    if (!dto || !dto.email || !dto.password) {
      throw new BadRequestException("Email and password are required");
    }

    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Check if account is active [BR-USR-03]
    if (!user.isActive) {
      throw new UnauthorizedException("Account has been disabled");
    }

    const isPasswordValid = await this.passwordService.comparePassword(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.tokenService.generateAccessToken(payload);
    const refreshToken = this.tokenService.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    if (!dto || !dto.refreshToken) {
      throw new BadRequestException("Refresh token is required");
    }

    const payload = this.tokenService.verifyRefreshToken(dto.refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Account has been disabled or not found");
    }

    const newPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.tokenService.generateAccessToken(newPayload);
    const refreshToken = this.tokenService.generateRefreshToken(newPayload);

    return {
      accessToken,
      refreshToken,
    };
  }

  async logout() {
    return {
      message: "Logged out successfully",
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, any> = {};

    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName.trim();
    }

    if (dto.avatarUrl !== undefined) {
      data.avatarUrl = dto.avatarUrl.trim();
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (!dto || !dto.currentPassword || !dto.newPassword) {
      throw new BadRequestException(
        "Current password and new password are required",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const isCurrentPasswordValid = await this.passwordService.comparePassword(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException("Current password is incorrect");
    }

    const newPasswordHash = await this.passwordService.hashPassword(
      dto.newPassword,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return {
      message: "Password changed successfully",
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    if (!dto || !dto.email) {
      throw new BadRequestException("Email is required");
    }

    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      // Do not leak user existence [Security Best Practice]
      return {
        message:
          "If this email is registered, password reset instructions have been sent.",
      };
    }

    const resetToken = this.tokenService.generatePasswordResetToken({
      sub: user.id,
      email: user.email,
    });

    return {
      message:
        "If this email is registered, password reset instructions have been sent.",
      resetToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (!dto || !dto.token || !dto.newPassword) {
      throw new BadRequestException("Token and new password are required");
    }

    const payload = this.tokenService.verifyPasswordResetToken(dto.token);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid token or account disabled");
    }

    const newPasswordHash = await this.passwordService.hashPassword(
      dto.newPassword,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return {
      message: "Password has been reset successfully",
    };
  }
}
