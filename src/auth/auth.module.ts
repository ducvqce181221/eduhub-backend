import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "./guards/optional-jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { CourseOwnershipGuard } from "./guards/course-ownership.guard";
import { RateLimitGuard } from "./guards/rate-limit.guard";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { GoogleStrategy } from "./strategies/google.strategy";
import { TurnstileService } from "./turnstile.service";

@Module({
  imports: [
    JwtModule.register({}),
    PassportModule.register({ defaultStrategy: "google" }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    TurnstileService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    CourseOwnershipGuard,
    RateLimitGuard,
    GoogleAuthGuard,
    GoogleStrategy,
    Reflector,
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    TurnstileService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    CourseOwnershipGuard,
    RateLimitGuard,
    GoogleAuthGuard,
    GoogleStrategy,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
