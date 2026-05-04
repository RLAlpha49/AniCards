import "@/tests/unit/__setup__";

import { describe, expect, it } from "bun:test";

import {
  createRequestProofCookie,
  createRequestProofToken,
  getRequestProofCookie,
  getTrustedClientIpHeaderNames,
  REQUEST_PROOF_COOKIE_NAME,
  REQUEST_PROOF_TTL_SECONDS,
  resolveVerifiedClientIp,
  verifyRequestProofToken,
} from "@/lib/api/request-proof";

const TEST_IP = "198.51.100.24";
const OTHER_IP = "198.51.100.25";
const TEST_USER_AGENT = "AniCardsTest/RequestProof";
const OTHER_USER_AGENT = "AniCardsTest/OtherRequestProof";
const TEST_SECRET = "test-request-proof-secret";

function createApiRequest(headers: HeadersInit = {}): Request {
  return new Request("https://anicards.test/api/test", {
    headers,
  });
}

function setProductionEnv(
  overrides: Record<string, string | undefined> = {},
): void {
  process.env = {
    ...process.env,
    NODE_ENV: "production",
    ...overrides,
  };
}

describe("lib/api/request-proof", () => {
  describe("getTrustedClientIpHeaderNames", () => {
    it("normalizes custom header names, drops invalid entries, and deduplicates defaults", () => {
      process.env.TRUSTED_CLIENT_IP_HEADERS =
        " X-Real-IP , cf-connecting-ip, bad header!, X-REAL-IP, x_real_ip ";

      const headerNames = getTrustedClientIpHeaderNames();

      expect(headerNames).toEqual([
        "x-vercel-forwarded-for",
        "cf-connecting-ip",
        "x-real-ip",
      ]);
    });
  });

  describe("resolveVerifiedClientIp", () => {
    it("returns invalid_trusted_header when proxy provenance exists but the trusted header value is not a valid IP", () => {
      setProductionEnv();

      const result = resolveVerifiedClientIp(
        createApiRequest({
          "x-vercel-forwarded-for": "definitely-not-an-ip",
          "x-vercel-id": "cle1::abc123",
        }),
      );

      expect(result).toEqual({
        verified: false,
        ip: null,
        source: null,
        reason: "invalid_trusted_header",
      });
    });

    it("normalizes bracketed IPv6 addresses from trusted proxy headers", () => {
      setProductionEnv();

      const result = resolveVerifiedClientIp(
        createApiRequest({
          "cf-connecting-ip": "[2001:DB8::1]",
          "cf-ray": "abc123-LHR",
        }),
      );

      expect(result).toEqual({
        verified: true,
        ip: "2001:db8::1",
        source: "cf-connecting-ip",
      });
    });
  });

  describe("request proof cookie helpers", () => {
    it("builds a strict request-proof cookie with the expected metadata", async () => {
      process.env.API_SECRET_TOKEN = TEST_SECRET;

      const cookie = await createRequestProofCookie({
        ip: TEST_IP,
        userAgent: TEST_USER_AGENT,
      });

      expect(cookie).not.toBeNull();
      expect(cookie?.name).toBe(REQUEST_PROOF_COOKIE_NAME);
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe("strict");
      expect(cookie?.secure).toBe(false);
      expect(cookie?.path).toBe("/");
      expect(cookie?.maxAge).toBe(REQUEST_PROOF_TTL_SECONDS);
      expect(cookie?.value.split(".")).toHaveLength(2);
    });

    it("extracts the request-proof cookie value even when the value contains equals signs", () => {
      const cookieValue = "payload.segment=signature==";

      const extractedCookie = getRequestProofCookie(
        createApiRequest({
          cookie: `theme=dark; ${REQUEST_PROOF_COOKIE_NAME}=${cookieValue}; session=abc123`,
        }),
      );

      expect(extractedCookie).toBe(cookieValue);
    });
  });

  describe("verifyRequestProofToken", () => {
    it("bypasses verification in test when no API secret is configured", async () => {
      const verification = await verifyRequestProofToken("ignored.token", {
        ip: TEST_IP,
        userAgent: TEST_USER_AGENT,
      });

      expect(verification).toEqual({
        valid: true,
        reason: "test_bypass",
      });
    });

    it("fails with missing_secret when enforcement is active without a configured secret", async () => {
      setProductionEnv({ API_SECRET_TOKEN: undefined });

      const verification = await verifyRequestProofToken("ignored.token", {
        ip: TEST_IP,
        userAgent: TEST_USER_AGENT,
      });

      expect(verification).toEqual({
        valid: false,
        reason: "missing_secret",
      });
    });

    it("rejects malformed tokens that contain more than two segments", async () => {
      process.env.API_SECRET_TOKEN = TEST_SECRET;

      const verification = await verifyRequestProofToken("one.two.three", {
        ip: TEST_IP,
        userAgent: TEST_USER_AGENT,
      });

      expect(verification).toEqual({
        valid: false,
        reason: "malformed_token",
      });
    });

    it("rejects tokens whose signature was tampered with", async () => {
      process.env.API_SECRET_TOKEN = TEST_SECRET;

      const token = await createRequestProofToken({
        ip: TEST_IP,
        userAgent: TEST_USER_AGENT,
      });
      if (!token) {
        throw new Error("Expected request proof token to be generated.");
      }

      const [payloadSegment, signatureSegment] = token.split(".");
      if (!payloadSegment || !signatureSegment) {
        throw new Error("Expected request proof token to have two segments.");
      }

      const tamperedSignature = `${signatureSegment.startsWith("a") ? "b" : "a"}${signatureSegment.slice(1)}`;
      const tamperedToken = `${payloadSegment}.${tamperedSignature}`;
      const verification = await verifyRequestProofToken(tamperedToken, {
        ip: TEST_IP,
        userAgent: TEST_USER_AGENT,
      });

      expect(verification).toEqual({
        valid: false,
        reason: "invalid_signature",
      });
    });

    it("rejects expired tokens", async () => {
      process.env.API_SECRET_TOKEN = TEST_SECRET;

      const token = await createRequestProofToken({
        ip: TEST_IP,
        userAgent: TEST_USER_AGENT,
        expiresAtMs: Date.now() - 1_000,
      });
      if (!token) {
        throw new Error("Expected request proof token to be generated.");
      }

      const verification = await verifyRequestProofToken(token, {
        ip: TEST_IP,
        userAgent: TEST_USER_AGENT,
      });

      expect(verification).toEqual({
        valid: false,
        reason: "expired",
      });
    });

    it("rejects tokens when the verified client IP does not match the signed IP", async () => {
      process.env.API_SECRET_TOKEN = TEST_SECRET;

      const token = await createRequestProofToken({
        ip: TEST_IP,
        userAgent: TEST_USER_AGENT,
      });
      if (!token) {
        throw new Error("Expected request proof token to be generated.");
      }

      const verification = await verifyRequestProofToken(token, {
        ip: OTHER_IP,
        userAgent: TEST_USER_AGENT,
      });

      expect(verification).toEqual({
        valid: false,
        reason: "ip_mismatch",
      });
    });

    it("rejects tokens when the normalized user agent does not match the signed user agent", async () => {
      process.env.API_SECRET_TOKEN = TEST_SECRET;

      const token = await createRequestProofToken({
        ip: TEST_IP,
        userAgent: TEST_USER_AGENT,
      });
      if (!token) {
        throw new Error("Expected request proof token to be generated.");
      }

      const verification = await verifyRequestProofToken(token, {
        ip: TEST_IP,
        userAgent: OTHER_USER_AGENT,
      });

      expect(verification).toEqual({
        valid: false,
        reason: "user_agent_mismatch",
      });
    });

    it("treats missing and whitespace-only user agents as the same normalized binding", async () => {
      process.env.API_SECRET_TOKEN = TEST_SECRET;

      const token = await createRequestProofToken({
        ip: TEST_IP,
      });
      if (!token) {
        throw new Error("Expected request proof token to be generated.");
      }

      const verification = await verifyRequestProofToken(token, {
        ip: TEST_IP,
        userAgent: "   ",
      });

      expect(verification.valid).toBe(true);
      if (!verification.valid) {
        throw new Error(
          "Expected normalized blank user agent binding to verify.",
        );
      }

      expect(verification.payload).toMatchObject({
        v: 1,
      });
    });
  });
});
