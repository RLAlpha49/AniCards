export type RequiredProductionEnvName =
  | "API_SECRET_TOKEN"
  | "CRON_SECRET"
  | "NEXT_PUBLIC_API_URL"
  | "NEXT_PUBLIC_APP_URL"
  | "UPSTASH_REDIS_REST_TOKEN"
  | "UPSTASH_REDIS_REST_URL";

interface ProductionEnvRequirement {
  name: RequiredProductionEnvName;
  description: string;
  invalidMessage?: string;
  validate?: (value: string) => boolean;
}

export interface ProductionEnvIssue {
  name: RequiredProductionEnvName;
  description: string;
  reason: "invalid" | "missing";
  message: string;
}

export interface ProductionEnvValidationOptions {
  names?: readonly RequiredProductionEnvName[];
}

export interface ProductionEnvValidationResult {
  valid: boolean;
  issues: ProductionEnvIssue[];
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const REQUIRED_PRODUCTION_ENV_REQUIREMENTS = [
  {
    name: "NEXT_PUBLIC_API_URL",
    description: "build-time public API configuration",
    invalidMessage: "NEXT_PUBLIC_API_URL must be an absolute http(s) URL.",
    validate: isValidHttpUrl,
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    description: "same-origin and JSON API CORS enforcement",
    invalidMessage: "NEXT_PUBLIC_APP_URL must be an absolute http(s) URL.",
    validate: isValidHttpUrl,
  },
  {
    name: "UPSTASH_REDIS_REST_URL",
    description: "Upstash Redis-backed storage and rate limiting",
    invalidMessage: "UPSTASH_REDIS_REST_URL must be an absolute https URL.",
    validate: isValidHttpsUrl,
  },
  {
    name: "UPSTASH_REDIS_REST_TOKEN",
    description: "Upstash Redis-backed storage and rate limiting",
  },
  {
    name: "CRON_SECRET",
    description: "cron endpoint authentication",
  },
  {
    name: "API_SECRET_TOKEN",
    description: "request-proof signing for protected write routes",
  },
] as const satisfies readonly ProductionEnvRequirement[];

function resolveProductionEnvRequirements(
  names?: readonly RequiredProductionEnvName[],
): readonly ProductionEnvRequirement[] {
  if (!names || names.length === 0) {
    return REQUIRED_PRODUCTION_ENV_REQUIREMENTS;
  }

  const selectedNames = new Set(names);
  return REQUIRED_PRODUCTION_ENV_REQUIREMENTS.filter(({ name }) =>
    selectedNames.has(name),
  );
}

function formatProductionEnvIssues(
  issues: readonly ProductionEnvIssue[],
): string {
  return issues.map((issue) => `- ${issue.name}: ${issue.message}`).join("\n");
}

export function validateRequiredProductionEnv(
  env: NodeJS.ProcessEnv = process.env,
  options?: ProductionEnvValidationOptions,
): ProductionEnvValidationResult {
  const issues = resolveProductionEnvRequirements(options?.names).flatMap(
    (requirement): ProductionEnvIssue[] => {
      const value = env[requirement.name]?.trim();

      if (!value) {
        return [
          {
            name: requirement.name,
            description: requirement.description,
            reason: "missing",
            message: [
              requirement.name,
              "is required in production for",
              `${requirement.description}.`,
            ].join(" "),
          },
        ];
      }

      if (requirement.validate && !requirement.validate(value)) {
        return [
          {
            name: requirement.name,
            description: requirement.description,
            reason: "invalid",
            message:
              requirement.invalidMessage ??
              [
                requirement.name,
                "is invalid for",
                `${requirement.description}.`,
              ].join(" "),
          },
        ];
      }

      return [];
    },
  );

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function assertRequiredProductionEnv(
  env: NodeJS.ProcessEnv = process.env,
  options?: ProductionEnvValidationOptions,
): void {
  const result = validateRequiredProductionEnv(env, options);
  if (result.valid) {
    return;
  }

  throw new Error(
    [
      "Missing or invalid required production env:",
      formatProductionEnvIssues(result.issues),
    ].join("\n"),
  );
}
