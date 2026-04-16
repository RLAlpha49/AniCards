import { describe, expect, it } from "bun:test";

import { validateRequiredProductionEnv } from "@/lib/api/production-env";

const BASE_PRODUCTION_ENV = {
  API_SECRET_TOKEN: "ci-placeholder-request-proof-secret",
  CRON_SECRET: "ci-placeholder-cron-secret",
  NEXT_PUBLIC_APP_URL: "https://anicards.alpha49.com",
  UPSTASH_REDIS_REST_TOKEN: "ci-placeholder-upstash-token",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
} as const;

describe("production env contract", () => {
  it("requires NEXT_PUBLIC_API_URL", () => {
    const result = validateRequiredProductionEnv(BASE_PRODUCTION_ENV);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "NEXT_PUBLIC_API_URL",
          reason: "missing",
        }),
      ]),
    );
  });

  it("accepts a valid absolute NEXT_PUBLIC_API_URL", () => {
    const result = validateRequiredProductionEnv({
      ...BASE_PRODUCTION_ENV,
      NEXT_PUBLIC_API_URL: "https://api.anicards.alpha49.com",
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
