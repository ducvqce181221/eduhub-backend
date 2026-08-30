import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface ResetPasswordPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class TokenService {
  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  generateAccessToken(payload: { sub: string; email: string; role: string }): string {
    const secret = this.configService.get<string>(
      "JWT_ACCESS_SECRET",
      "eduhub-access-secret",
    );
    const expiresIn = this.configService.get<string>(
      "JWT_ACCESS_EXPIRES_IN",
      "15m",
    );

    return this.jwtService.sign(payload, {
      secret,
      expiresIn: expiresIn as any,
    });
  }

  generateRefreshToken(payload: { sub: string; email: string; role: string }): string {
    const secret = this.configService.get<string>(
      "JWT_REFRESH_SECRET",
      "eduhub-refresh-secret",
    );
    const expiresIn = this.configService.get<string>(
      "JWT_REFRESH_EXPIRES_IN",
      "7d",
    );

    return this.jwtService.sign(payload, {
      secret,
      expiresIn: expiresIn as any,
    });
  }

  generatePasswordResetToken(payload: { sub: string; email: string }): string {
    const secret = this.configService.get<string>(
      "JWT_ACCESS_SECRET",
      "eduhub-access-secret",
    );

    return this.jwtService.sign(payload, {
      secret,
      expiresIn: "1h" as any,
    });
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      const secret = this.configService.get<string>(
        "JWT_ACCESS_SECRET",
        "eduhub-access-secret",
      );
      return this.jwtService.verify<JwtPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }

  verifyRefreshToken(token: string): JwtPayload {
    try {
      const secret = this.configService.get<string>(
        "JWT_REFRESH_SECRET",
        "eduhub-refresh-secret",
      );
      return this.jwtService.verify<JwtPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  verifyPasswordResetToken(token: string): ResetPasswordPayload {
    try {
      const secret = this.configService.get<string>(
        "JWT_ACCESS_SECRET",
        "eduhub-access-secret",
      );
      return this.jwtService.verify<ResetPasswordPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException("Invalid or expired password reset token");
    }
  }
}
