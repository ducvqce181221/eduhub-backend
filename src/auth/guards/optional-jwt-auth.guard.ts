import { Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { TokenService } from "../token.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TokenService)
    private readonly tokenService: TokenService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return true;
    }

    const bearerMatch = authHeader.match(/^bearer\s+(\S+)$/i);
    if (!bearerMatch || !bearerMatch[1]) {
      return true;
    }

    const token = bearerMatch[1].trim();
    if (!token) {
      return true;
    }

    try {
      const payload = this.tokenService.verifyAccessToken(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      if (user && user.isActive) {
        request.user = {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      }
    } catch {
      // Ignore invalid token on optional auth routes
    }

    return true;
  }
}
