import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "./guards/optional-jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { CourseOwnershipGuard } from "./guards/course-ownership.guard";

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
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    CourseOwnershipGuard,
    JwtModule,
  ],
})
export class AuthModule {}
