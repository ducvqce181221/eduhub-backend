import { BadRequestException } from "@nestjs/common";
import { promises as dns } from "node:dns";
import net from "node:net";

/**
 * Checks if an IPv4 or IPv6 address is private, loopback, or link-local.
 */
export function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) {
    return false;
  }

  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map((part) => parseInt(part, 10));
    const [p0, p1] = parts;

    // 0.0.0.0/8
    if (p0 === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (p0 === 127) return true;
    // 10.0.0.0/8 (Private)
    if (p0 === 10) return true;
    // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (p0 === 192 && p1 === 168) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (p0 === 169 && p1 === 254) return true;

    return false;
  }

  // IPv6 checks
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  // fc00::/7 (Unique local)
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // fe80::/10 (Link-local)
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return true;
  }

  return false;
}

export interface ValidatedUrlResult {
  normalizedUrl: string;
  mimeType: string;
  fileSize?: number;
}

/**
 * Validates protocol, hostname, DNS, and IP address safety to prevent SSRF.
 */
export async function validateUrlSafety(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestException("Invalid URL format. Must be a valid absolute HTTP or HTTPS URL.");
  }

  // 1. Strict protocol check (only http and https)
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BadRequestException(
      `Invalid URL protocol: '${parsed.protocol}'. Only http:// and https:// are supported.`,
    );
  }

  const hostname = parsed.hostname;

  // 2. Reject obvious localhost / private names
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "0.0.0.0" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    throw new BadRequestException("Access to local or private network addresses is not allowed.");
  }

  // 3. DNS resolution & SSRF IP check
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        throw new BadRequestException(
          "Access to internal, local, or private network addresses is prohibited.",
        );
      }
    }
  } catch (err: any) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException(`Could not resolve hostname '${hostname}'. Please verify the domain name.`);
  }

  return parsed;
}

const MAX_REDIRECT_HOPS = 3;

/**
 * Executes a fetch request with manual redirect following, validating target URL safety at each hop.
 */
async function safeFetchWithRedirects(
  initialUrl: string,
  method: "HEAD" | "GET",
  headers: Record<string, string>,
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = initialUrl;
  let hopCount = 0;

  while (true) {
    await validateUrlSafety(currentUrl);

    const response = await fetch(currentUrl, {
      method,
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });

    const isRedirect =
      response.status === 301 ||
      response.status === 302 ||
      response.status === 303 ||
      response.status === 307 ||
      response.status === 308;

    if (isRedirect) {
      hopCount++;
      if (hopCount > MAX_REDIRECT_HOPS) {
        throw new BadRequestException("Too many redirects (exceeded maximum limit of 3).");
      }

      const location = response.headers.get("location");
      if (!location) {
        throw new BadRequestException("External URL redirect response is missing a Location header.");
      }

      // Resolve relative redirect against current URL
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return { response, finalUrl: currentUrl };
  }
}

/**
 * Validates scheme, guards against SSRF across all redirect hops, and tests reachability of external URLs.
 */
export async function validateAndInspectExternalUrl(
  rawUrl: string,
): Promise<ValidatedUrlResult> {
  const initialParsed = await validateUrlSafety(rawUrl);
  const normalizedInitialUrl = initialParsed.toString();

  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 EduHub/1.0";

  let response: Response;
  let finalUrl: string;

  try {
    // 1. Try HEAD request with safe redirect tracking
    const result = await safeFetchWithRedirects(normalizedInitialUrl, "HEAD", {
      "User-Agent": userAgent,
    });
    response = result.response;
    finalUrl = result.finalUrl;

    // 2. If HEAD is disallowed (405) or forbidden (403), fallback to light GET (Range: bytes=0-0)
    if (response.status === 405 || response.status === 403) {
      const getResult = await safeFetchWithRedirects(normalizedInitialUrl, "GET", {
        "User-Agent": userAgent,
        Range: "bytes=0-0",
      });
      response = getResult.response;
      finalUrl = getResult.finalUrl;
    }
  } catch (err: any) {
    if (err instanceof BadRequestException) {
      throw err;
    }
    throw new BadRequestException(
      `Failed to connect to the external URL: ${err.message || "Connection timed out or network error"}. Please ensure the URL is publicly accessible.`,
    );
  }

  if (response.status >= 400) {
    throw new BadRequestException(
      `External URL is not reachable (HTTP ${response.status} ${response.statusText}).`,
    );
  }

  // Extract content-type & content-length if available
  const rawContentType = response.headers.get("content-type") || "";
  const mimeType = rawContentType.split(";")[0].trim().toLowerCase() || "application/octet-stream";

  const rawLength = response.headers.get("content-length");
  let fileSize: number | undefined;
  if (rawLength) {
    const parsedLength = parseInt(rawLength, 10);
    if (!isNaN(parsedLength) && parsedLength > 0 && parsedLength <= 2147483647) {
      fileSize = parsedLength;
    }
  }

  return {
    normalizedUrl: finalUrl,
    mimeType,
    fileSize,
  };
}
