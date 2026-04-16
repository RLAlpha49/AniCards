import { appendFileSync } from "node:fs";

import { resolveTrustedAniCardsBaseUrl } from "../lib/playwright-base-url";

const rawCandidate = (
  process.env.DEPLOYMENT_URL ||
  process.env.TARGET_URL ||
  ""
).trim();

if (!rawCandidate) {
  throw new Error(
    "deployment_status is missing both environment_url and target_url.",
  );
}

const resolvedBaseUrl = resolveTrustedAniCardsBaseUrl(
  rawCandidate,
  "Deployment URL",
);
const githubEnvPath = process.env.GITHUB_ENV?.trim();

if (!githubEnvPath) {
  throw new Error(
    "GITHUB_ENV is required to publish deployed smoke environment variables.",
  );
}
appendFileSync(
  githubEnvPath,
  `PLAYWRIGHT_BASE_URL=${resolvedBaseUrl.origin}\n`,
);
appendFileSync(
  githubEnvPath,
  `PLAYWRIGHT_CAN_SEND_BYPASS=${resolvedBaseUrl.canSendBypassHeaders ? "1" : "0"}\n`,
);

console.log(`[INFO] Using deployed smoke URL: ${resolvedBaseUrl.origin}`);
console.log(
  `[INFO] ${
    resolvedBaseUrl.canSendBypassHeaders
      ? "Trusted AniCards preview host detected; bypass headers may be used if configured."
      : "Public AniCards host detected; bypass headers disabled."
  }`,
);
