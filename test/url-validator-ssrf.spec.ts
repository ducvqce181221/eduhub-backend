import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BadRequestException } from "@nestjs/common";
import {
  isPrivateIp,
  validateUrlSafety,
  validateAndInspectExternalUrl,
} from "../src/common/utils/url-validator.util";

describe("Security: SSRF & Redirect Bypass Prevention [Vulnerability 4]", () => {
  describe("isPrivateIp", () => {
    it("should identify IPv4 loopback and private ranges", () => {
      expect(isPrivateIp("127.0.0.1")).toBe(true);
      expect(isPrivateIp("10.0.0.1")).toBe(true);
      expect(isPrivateIp("172.16.0.5")).toBe(true);
      expect(isPrivateIp("172.31.255.255")).toBe(true);
      expect(isPrivateIp("192.168.1.1")).toBe(true);
      expect(isPrivateIp("169.254.169.254")).toBe(true); // AWS / Cloud metadata
      expect(isPrivateIp("0.0.0.0")).toBe(true);

      // Public IPs
      expect(isPrivateIp("8.8.8.8")).toBe(false);
      expect(isPrivateIp("1.1.1.1")).toBe(false);
    });

    it("should identify IPv6 private ranges", () => {
      expect(isPrivateIp("::1")).toBe(true);
      expect(isPrivateIp("fc00::1")).toBe(true);
      expect(isPrivateIp("fe80::1")).toBe(true);
    });
  });

  describe("validateUrlSafety", () => {
    it("should reject non-http/https protocols like file:// or ftp://", async () => {
      await expect(validateUrlSafety("file:///etc/passwd")).rejects.toThrow(
        BadRequestException,
      );
      await expect(validateUrlSafety("ftp://example.com/file")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject localhost and 127.0.0.1 hostnames", async () => {
      await expect(validateUrlSafety("http://localhost:5000/api")).rejects.toThrow(
        BadRequestException,
      );
      await expect(validateUrlSafety("http://127.0.0.1:8080/secret")).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        validateUrlSafety("http://169.254.169.254/latest/meta-data"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("validateAndInspectExternalUrl with Redirects", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it("should catch and block HTTP 302 redirect pointing to internal private IP", async () => {
      // First hop: returns 302 redirecting to AWS metadata service 169.254.169.254
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "https://attacker.com/malicious.pdf") {
          return Promise.resolve({
            status: 302,
            statusText: "Found",
            headers: new Headers({
              location: "http://169.254.169.254/latest/meta-data",
            }),
          } as Response);
        }
        return Promise.reject(new Error("Should not reach internal IP"));
      });

      await expect(
        validateAndInspectExternalUrl("https://attacker.com/malicious.pdf"),
      ).rejects.toThrow(
        "Access to internal, local, or private network addresses is prohibited.",
      );
    });

    it("should catch and block HTTP 302 redirect pointing to localhost", async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "https://attacker.com/doc.pdf") {
          return Promise.resolve({
            status: 302,
            statusText: "Found",
            headers: new Headers({
              location: "http://127.0.0.1:5000/api/v1/admin/users",
            }),
          } as Response);
        }
        return Promise.reject(new Error("Should not reach localhost"));
      });

      await expect(
        validateAndInspectExternalUrl("https://attacker.com/doc.pdf"),
      ).rejects.toThrow(
        "Access to local or private network addresses is not allowed.",
      );
    });

    it("should block redirect chains that exceed MAX_REDIRECT_HOPS (3)", async () => {
      let count = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        count++;
        return Promise.resolve({
          status: 302,
          statusText: "Found",
          headers: new Headers({
            location: `https://attacker.com/hop-${count}.pdf`,
          }),
        } as Response);
      });

      await expect(
        validateAndInspectExternalUrl("https://attacker.com/hop-0.pdf"),
      ).rejects.toThrow("Too many redirects (exceeded maximum limit of 3).");
    });

    it("should safely follow a valid redirect to a public resource", async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "https://github.com/guide") {
          return Promise.resolve({
            status: 301,
            statusText: "Moved Permanently",
            headers: new Headers({
              location: "https://nestjs.com/guide.pdf",
            }),
          } as Response);
        }
        if (url === "https://nestjs.com/guide.pdf") {
          return Promise.resolve({
            status: 200,
            statusText: "OK",
            headers: new Headers({
              "content-type": "application/pdf",
              "content-length": "4096",
            }),
          } as Response);
        }
        return Promise.reject(new Error("Unexpected URL"));
      });

      const result = await validateAndInspectExternalUrl("https://github.com/guide");
      expect(result.normalizedUrl).toBe("https://nestjs.com/guide.pdf");
      expect(result.mimeType).toBe("application/pdf");
      expect(result.fileSize).toBe(4096);
    });
  });
});
