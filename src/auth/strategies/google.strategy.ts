import { Inject, Injectable, Optional } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-google-oauth20";
import type { VerifyCallback } from "passport-google-oauth20";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(
    @Optional()
    @Inject(ConfigService)
    private readonly configService?: ConfigService,
  ) {
    const clientID =
      configService?.get<string>("GOOGLE_CLIENT_ID") ||
      process.env.GOOGLE_CLIENT_ID ||
      "mock-google-client-id";
    const clientSecret =
      configService?.get<string>("GOOGLE_CLIENT_SECRET") ||
      process.env.GOOGLE_CLIENT_SECRET ||
      "mock-google-client-secret";
    const callbackURL =
      configService?.get<string>("GOOGLE_CALLBACK_URL") ||
      process.env.GOOGLE_CALLBACK_URL ||
      "http://localhost:5000/api/v1/auth/google/callback";

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ["email", "profile"],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    done(null, profile);
  }
}
