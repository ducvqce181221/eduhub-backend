import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(
    @Optional()
    @Inject(ConfigService)
    private readonly configService?: ConfigService,
  ) {}

  async verifyToken(
    token?: string,
    remoteIp?: string,
    expectedAction?: string,
  ): Promise<boolean> {
    const isTest = process.env.NODE_ENV === "test";
    const secretKey =
      this.configService?.get<string>("TURNSTILE_SECRET_KEY") ||
      process.env.TURNSTILE_SECRET_KEY;

    // In automated test environment: bypass if no token or test token provided
    if (isTest) {
      if (!token || token.startsWith("1x00") || token.toLowerCase().includes("test")) {
        return true;
      }
    }

    // Check if Turnstile is explicitly disabled via ENABLE_TURNSTILE=false
    const isTurnstileEnabled =
      (this.configService?.get<string>("ENABLE_TURNSTILE") ??
        process.env.ENABLE_TURNSTILE ??
        "true").toLowerCase() !== "false";

    if (!isTurnstileEnabled) {
      this.logger.warn(
        "Cloudflare Turnstile verification is disabled by ENABLE_TURNSTILE=false.",
      );
      return true;
    }

    // In dev environment when no secret key configured: allow with warning
    if (!secretKey) {
      if (process.env.NODE_ENV === "production") {
        this.logger.error("TURNSTILE_SECRET_KEY is missing in production environment!");
        throw new BadRequestException(
          "Security configuration error. CAPTCHA verification unavailable. Please provide TURNSTILE_SECRET_KEY or set ENABLE_TURNSTILE=false.",
        );
      }
      this.logger.warn(
        "TURNSTILE_SECRET_KEY is not configured in .env; skipping verification in development.",
      );
      return true;
    }

    if (!token || typeof token !== "string" || !token.trim()) {
      throw new BadRequestException(
        "CAPTCHA verification required. Please complete the security challenge.",
      );
    }

    if (token.length > 2048) {
      throw new BadRequestException("Invalid CAPTCHA token format.");
    }

    try {
      const body = new URLSearchParams();
      body.append("secret", secretKey);
      body.append("response", token.trim());
      if (remoteIp) {
        body.append("remoteip", remoteIp);
      }

      const response = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          signal: AbortSignal.timeout(10_000),
          body: body.toString(),
        },
      );

      if (!response.ok) {
        this.logger.warn(`Cloudflare Turnstile API HTTP error ${response.status}`);
        throw new BadRequestException(
          "CAPTCHA verification service error. Please try again.",
        );
      }

      const result = (await response.json()) as {
        success: boolean;
        "error-codes"?: string[];
        challenge_ts?: string;
        hostname?: string;
        action?: string;
      };

      if (!result.success) {
        this.logger.warn(
          `Turnstile validation rejected: ${JSON.stringify(result["error-codes"] || [])}`,
        );
        throw new BadRequestException(
          "CAPTCHA verification failed or token expired. Please try again.",
        );
      }

      // Action validation (if expected)
      if (expectedAction && result.action && result.action !== expectedAction) {
        this.logger.warn(
          `Turnstile action mismatch: expected '${expectedAction}', received '${result.action}'`,
        );
        throw new BadRequestException(
          "CAPTCHA action verification failed. Please try again.",
        );
      }

      // Hostname validation (if configured)
      const rawHostnames =
        this.configService?.get<string>("TURNSTILE_HOSTNAMES") ||
        process.env.TURNSTILE_HOSTNAMES;
      if (rawHostnames && result.hostname) {
        const expectedHostnames = new Set(
          rawHostnames
            .split(",")
            .map((h) => h.trim())
            .filter(Boolean),
        );
        if (expectedHostnames.size > 0 && !expectedHostnames.has(result.hostname)) {
          this.logger.warn(
            `Turnstile hostname mismatch: got '${result.hostname}', allowed: ${Array.from(expectedHostnames).join(", ")}`,
          );
          throw new BadRequestException(
            "CAPTCHA hostname verification failed.",
          );
        }
      }

      return true;
    } catch (err: any) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`Turnstile verification network failure: ${err.message}`);
      throw new BadRequestException(
        "Failed to verify security challenge. Please try again.",
      );
    }
  }
}
