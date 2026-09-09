import { Injectable } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  override getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const returnUrl = req.query?.returnUrl;
    if (returnUrl) {
      const state = Buffer.from(JSON.stringify({ returnUrl })).toString("base64");
      return { state };
    }
    return {};
  }
}
