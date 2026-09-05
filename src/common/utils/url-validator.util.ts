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
 * Validates scheme, guards against SSRF, and tests reachability of external URLs.
 */
export async function validateAndInspectExternalUrl(
  rawUrl: string,
): Promise<ValidatedUrlResult> {
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

  // 2. Reject obvious localhost names
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

  // 4. Reachability check (HEAD with GET fallback)
  const normalizedUrl = parsed.toString();
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 EduHub/1.0";

  let response: Response;
  try {
    // Try HEAD request first
    response = await fetch(normalizedUrl, {
      method: "HEAD",
      headers: { "User-Agent": userAgent },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });

    // If HEAD is disallowed (405 Method Not Allowed) or blocked, fallback to light GET
    if (response.status === 405 || response.status === 403) {
      response = await fetch(normalizedUrl, {
        method: "GET",
        headers: {
          "User-Agent": userAgent,
          Range: "bytes=0-0",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
    }
  } catch (err: any) {
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
    normalizedUrl,
    mimeType,
    fileSize,
  };
}
