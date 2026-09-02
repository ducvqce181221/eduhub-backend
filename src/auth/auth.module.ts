import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "./guards/optional-jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { CourseOwnershipGuard } from "./guards/course-ownership.guard";
import { RateLimitGuard } from "./guards/rate-limit.guard";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    CourseOwnershipGuard,
    RateLimitGuard,
    Reflector,
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    CourseOwnershipGuard,
    RateLimitGuard,
    JwtModule,
  ],
})
export class AuthModule {}
