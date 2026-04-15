import { appendFileSync } from "node:fs";

import {
  isTrustedAniCardsPreviewHost,
  parseTrustedAniCardsBaseUrl,
} from "../lib/playwright-base-url";

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

const parsedUrl = parseTrustedAniCardsBaseUrl(rawCandidate, "Deployment URL");
const githubEnvPath = process.env.GITHUB_ENV?.trim();

if (!githubEnvPath) {
  throw new Error(
    "GITHUB_ENV is required to publish deployed smoke environment variables.",
  );
}

const isTrustedPreviewHost = isTrustedAniCardsPreviewHost(parsedUrl.hostname);

appendFileSync(githubEnvPath, `PLAYWRIGHT_BASE_URL=${parsedUrl.origin}\n`);
appendFileSync(
  githubEnvPath,
  `PLAYWRIGHT_CAN_SEND_BYPASS=${isTrustedPreviewHost ? "1" : "0"}\n`,
);

console.log(`[INFO] Using deployed smoke URL: ${parsedUrl.origin}`);
console.log(
  `[INFO] ${
    isTrustedPreviewHost
      ? "Trusted AniCards preview host detected; bypass headers may be used if configured."
      : "Public AniCards host detected; bypass headers disabled."
  }`,
);
