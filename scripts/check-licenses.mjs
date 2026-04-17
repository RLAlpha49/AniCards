import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";

const require = createRequire(import.meta.url);
const rootDir = process.cwd();
const policyPath = join(rootDir, "dependency-license-policy.json");
const reportDir = join(rootDir, ".artifacts", "licenses");
const reportPath = join(reportDir, "license-policy-report.json");
const licenseCheckerPackageJsonPath = join(
  rootDir,
  "node_modules",
  "license-checker-rseidelsohn",
  "package.json",
);
const scannerBinaryCandidates = [
  join(rootDir, "node_modules", ".bin", "license-checker-rseidelsohn"),
  join(rootDir, "node_modules", ".bin", "license-checker-rseidelsohn.exe"),
  join(rootDir, "node_modules", ".bin", "license-checker-rseidelsohn.cmd"),
  join(rootDir, "node_modules", ".bin", "license-checker-rseidelsohn.bunx"),
];
const scannerBinaryPath =
  scannerBinaryCandidates.find((candidatePath) => existsSync(candidatePath)) ??
  scannerBinaryCandidates[0];
const parseSpdxExpression = loadSpdxExpressionParser();

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function loadSpdxExpressionParser() {
  for (const candidateRequire of [require]) {
    try {
      const importedModule = candidateRequire("spdx-expression-parse");
      if (typeof importedModule === "function") {
        return importedModule;
      }

      if (typeof importedModule?.default === "function") {
        return importedModule.default;
      }
    } catch {
      // Ignore missing candidates and continue to the next resolver.
    }
  }

  if (existsSync(licenseCheckerPackageJsonPath)) {
    try {
      const resolutionBaseDir = dirname(
        realpathSync(licenseCheckerPackageJsonPath),
      );
      const resolvedModulePath = require.resolve("spdx-expression-parse", {
        paths: [resolutionBaseDir],
      });
      const importedModule = require(resolvedModulePath);
      if (typeof importedModule === "function") {
        return importedModule;
      }

      if (typeof importedModule?.default === "function") {
        return importedModule.default;
      }
    } catch {
      // Ignore lookup failures and fall back to the validation error below.
    }
  }

  return null;
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value
        .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.trim())
    : [];
}

function normalizeLicenseExpression(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeLicenseExpression(entry))
      .filter(Boolean)
      .join(" OR ");
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (value && typeof value === "object") {
    if (typeof value.licenses === "string") {
      return value.licenses.trim();
    }

    if (typeof value.license === "string") {
      return value.license.trim();
    }
  }

  return "";
}

function splitPackageSpec(packageSpec) {
  const lastAt = packageSpec.lastIndexOf("@");
  if (lastAt <= 0) {
    return {
      name: packageSpec,
      version: "",
    };
  }

  return {
    name: packageSpec.slice(0, lastAt),
    version: packageSpec.slice(lastAt + 1),
  };
}

function normalizeScanScopes(value) {
  if (!value || typeof value !== "object") {
    return {
      production: true,
      development: false,
    };
  }

  return {
    production: value.production !== false,
    development: value.development === true,
  };
}

function buildScannerArgs(scanAllInstalledDependencies) {
  const baseArgs = ["--excludePrivatePackages", "--json"];

  if (scanAllInstalledDependencies) {
    return baseArgs;
  }

  return ["--production", ...baseArgs];
}

function getOptionalStringProperty(value, propertyName) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const propertyValue = value[propertyName];
  return typeof propertyValue === "string" ? propertyValue : undefined;
}

function tryParseSpdxExpression(expression) {
  if (
    typeof expression !== "string" ||
    expression.trim().length === 0 ||
    typeof parseSpdxExpression !== "function"
  ) {
    return null;
  }

  try {
    return parseSpdxExpression(expression);
  } catch {
    return null;
  }
}

function collectSpdxLicenseIds(node, licenseIds = new Set()) {
  if (!node || typeof node !== "object") {
    return licenseIds;
  }

  if (typeof node.license === "string" && node.license.trim().length > 0) {
    licenseIds.add(node.license.trim());
  }

  if (node.left) {
    collectSpdxLicenseIds(node.left, licenseIds);
  }

  if (node.right) {
    collectSpdxLicenseIds(node.right, licenseIds);
  }

  return licenseIds;
}

function analyzeSelectedLicense(selectedLicense, denyPolicy) {
  const normalizedSelectedLicense =
    typeof selectedLicense === "string" ? selectedLicense.trim() : "";
  const uppercaseSelectedLicense = normalizedSelectedLicense.toUpperCase();
  const matchedDeniedSpdxRules = [];

  if (denyPolicy.deniedSpdxLicenseIds.has(uppercaseSelectedLicense)) {
    matchedDeniedSpdxRules.push(normalizedSelectedLicense);
  }

  for (const prefix of denyPolicy.deniedSpdxLicensePrefixes) {
    if (uppercaseSelectedLicense.startsWith(prefix)) {
      matchedDeniedSpdxRules.push(prefix);
    }
  }

  const matchedDeniedSubstrings = denyPolicy.deniedLicenseSubstrings.filter(
    (token) => uppercaseSelectedLicense.includes(token),
  );

  return {
    normalizedSelectedLicense,
    matchedDeniedSpdxRules,
    matchedDeniedSubstrings,
    isDenied:
      matchedDeniedSpdxRules.length > 0 || matchedDeniedSubstrings.length > 0,
  };
}

function analyzeLicenseExpression(expression, denyPolicy) {
  const normalizedExpression =
    typeof expression === "string" ? expression.trim() : "";
  const parsedExpression = tryParseSpdxExpression(normalizedExpression);
  const spdxLicenseIds = parsedExpression
    ? [...collectSpdxLicenseIds(parsedExpression)]
    : [];
  const matchedDeniedSpdxLicenses = spdxLicenseIds.filter((licenseId) => {
    const uppercaseLicenseId = licenseId.toUpperCase();
    return (
      denyPolicy.deniedSpdxLicenseIds.has(uppercaseLicenseId) ||
      denyPolicy.deniedSpdxLicensePrefixes.some((prefix) =>
        uppercaseLicenseId.startsWith(prefix),
      )
    );
  });
  const uppercaseExpression = normalizedExpression.toUpperCase();
  const matchedDeniedSubstrings = denyPolicy.deniedLicenseSubstrings.filter(
    (token) => uppercaseExpression.includes(token),
  );
  let parseStatus = "empty";

  if (typeof parseSpdxExpression !== "function") {
    parseStatus = "unavailable";
  } else if (parsedExpression) {
    parseStatus = "parsed";
  } else if (normalizedExpression.length > 0) {
    parseStatus = "unparsed";
  }

  return {
    parseStatus,
    spdxLicenseIds,
    matchedDeniedSpdxLicenses,
    matchedDeniedSubstrings,
    isDenied:
      matchedDeniedSpdxLicenses.length > 0 ||
      matchedDeniedSubstrings.length > 0,
  };
}

function licenseExpressionIncludesLicense(expression, selectedLicense) {
  if (
    typeof selectedLicense !== "string" ||
    selectedLicense.trim().length === 0
  ) {
    return false;
  }

  const normalizedSelectedLicense = selectedLicense.trim();
  const parsedExpression = tryParseSpdxExpression(expression);
  if (parsedExpression) {
    return collectSpdxLicenseIds(parsedExpression).has(
      normalizedSelectedLicense,
    );
  }

  return expression
    .toUpperCase()
    .includes(normalizedSelectedLicense.toUpperCase());
}

function collectPackageSelectionViolations(options) {
  const { licenseAnalysis, licenseExpression, packageSelection } = options;
  const violations = [];

  if (packageSelection) {
    if (
      typeof packageSelection.observedLicenseExpression === "string" &&
      packageSelection.observedLicenseExpression !== licenseExpression
    ) {
      violations.push(
        `Observed license expression changed from ${packageSelection.observedLicenseExpression} to ${licenseExpression || "<empty>"}.`,
      );
    }

    if (
      typeof packageSelection.selectedLicense !== "string" ||
      packageSelection.selectedLicense.trim().length === 0
    ) {
      violations.push("Selected license must be a non-empty string.");
    } else if (
      !licenseExpressionIncludesLicense(
        licenseExpression,
        packageSelection.selectedLicense,
      )
    ) {
      violations.push(
        `Selected license ${packageSelection.selectedLicense} is not present in the observed expression ${licenseExpression || "<empty>"}.`,
      );
    }
  }

  if (packageSelection == null && licenseAnalysis.isDenied) {
    violations.push(
      `Denied SPDX or substring policy requires an explicit package review selection: ${licenseExpression || "<empty>"}.`,
    );
  }

  return violations;
}

function getPackageEntryStatus(violations, packageSelection) {
  if (violations.length > 0) {
    return "violation";
  }

  if (packageSelection) {
    return "allowed-by-policy";
  }

  return "allowed";
}

function buildPackageEntry(packageSpec, metadata, options) {
  const packageSelection = options.packageLicenseSelections[packageSpec];
  const licenseExpression = normalizeLicenseExpression(
    metadata?.licenses ?? metadata?.license,
  );
  const licenseAnalysis = analyzeLicenseExpression(
    licenseExpression,
    options.deniedLicensePolicy,
  );
  const selectedLicenseAnalysis = packageSelection
    ? analyzeSelectedLicense(
        packageSelection.selectedLicense,
        options.deniedLicensePolicy,
      )
    : null;
  const violations = collectPackageSelectionViolations({
    licenseAnalysis,
    licenseExpression,
    packageSelection,
  });
  const { name, version } = splitPackageSpec(packageSpec);

  return {
    packageSpec,
    name,
    version,
    licenseExpression,
    repository: getOptionalStringProperty(metadata, "repository"),
    path: getOptionalStringProperty(metadata, "path"),
    policySelection: packageSelection ?? null,
    spdxAnalysis: {
      parseStatus: licenseAnalysis.parseStatus,
      licenseIds: licenseAnalysis.spdxLicenseIds,
      deniedMatches: {
        spdxLicenses: licenseAnalysis.matchedDeniedSpdxLicenses,
        substrings: licenseAnalysis.matchedDeniedSubstrings,
      },
    },
    usesDeniedLicenseException:
      Boolean(packageSelection) && Boolean(selectedLicenseAnalysis?.isDenied),
    status: getPackageEntryStatus(violations, packageSelection),
    violations,
  };
}

if (!existsSync(policyPath)) {
  console.error(
    `Missing dependency license policy file: ${relative(rootDir, policyPath)}`,
  );
  process.exit(1);
}

if (!existsSync(scannerBinaryPath)) {
  console.error(
    [
      "Missing local license-checker-rseidelsohn binary.",
      "Run `bun install` before running `bun run check:licenses`.",
    ].join(" "),
  );
  process.exit(1);
}

const policy = readJsonFile(policyPath);
const scanScopes = normalizeScanScopes(policy.scanScopes);
const deniedLicenseSubstrings = normalizeStringArray(
  policy.denyLicenseSubstrings,
).map((token) => token.toUpperCase());
const deniedSpdxLicenseIds = new Set(
  normalizeStringArray(policy.denySpdxLicenseIds).map((licenseId) =>
    licenseId.toUpperCase(),
  ),
);
const deniedSpdxLicensePrefixes = normalizeStringArray(
  policy.denySpdxLicensePrefixes,
).map((prefix) => prefix.toUpperCase());
const packageLicenseSelections =
  policy.packageLicenseSelections &&
  typeof policy.packageLicenseSelections === "object"
    ? policy.packageLicenseSelections
    : {};
const scanAllInstalledDependencies = scanScopes.development === true;
const scannerArgs = buildScannerArgs(scanAllInstalledDependencies);
const deniedLicensePolicy = {
  deniedLicenseSubstrings,
  deniedSpdxLicenseIds,
  deniedSpdxLicensePrefixes,
};

if (!scanScopes.production) {
  console.error(
    "Dependency license policy must keep production dependency scanning enabled.",
  );
  process.exit(1);
}

if (
  typeof parseSpdxExpression !== "function" &&
  (deniedSpdxLicenseIds.size > 0 || deniedSpdxLicensePrefixes.length > 0)
) {
  console.error(
    [
      "Missing SPDX expression parser for enriched dependency license evaluation.",
      "Run `bun install` before running `bun run check:licenses`.",
    ].join(" "),
  );
  process.exit(1);
}

const scanResult = spawnSync(scannerBinaryPath, scannerArgs, {
  cwd: rootDir,
  encoding: "utf8",
  env: process.env,
});

if (scanResult.status !== 0) {
  console.error(
    scanResult.stderr || scanResult.stdout || "License scan failed.",
  );
  process.exit(scanResult.status ?? 1);
}

const scanOutputText = scanResult.stdout?.trim() || "{}";
const scanOutput = JSON.parse(scanOutputText);
const packageEntries = Object.entries(scanOutput).map(
  ([packageSpec, metadata]) =>
    buildPackageEntry(packageSpec, metadata, {
      deniedLicensePolicy,
      packageLicenseSelections,
    }),
);

mkdirSync(reportDir, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  policyVersion: policy.version ?? 1,
  scanner: {
    name: "license-checker-rseidelsohn",
    scope: scanAllInstalledDependencies
      ? "production-and-development"
      : "production-only",
    command: [relative(rootDir, scannerBinaryPath), ...scannerArgs],
  },
  summary: {
    totalPackages: packageEntries.length,
    scanScopes,
    deniedSpdxLicenseIds: [...deniedSpdxLicenseIds],
    deniedSpdxLicensePrefixes,
    deniedLicenseSubstrings,
    explicitSelections: packageEntries.filter(
      (entry) => entry.status === "allowed-by-policy",
    ).length,
    reviewedDeniedLicenseExceptions: packageEntries.filter(
      (entry) => entry.usesDeniedLicenseException,
    ).length,
    violations: packageEntries.reduce(
      (total, entry) => total + entry.violations.length,
      0,
    ),
  },
  packages: packageEntries,
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

const violatingEntries = packageEntries.filter(
  (entry) => entry.violations.length > 0,
);
if (violatingEntries.length > 0) {
  console.error("Dependency license policy violations detected:");
  for (const entry of violatingEntries) {
    for (const violation of entry.violations) {
      console.error(`- ${entry.packageSpec}: ${violation}`);
    }
  }
  console.error(`Machine-readable report: ${relative(rootDir, reportPath)}`);
  process.exit(1);
}

console.log(
  [
    `Checked ${packageEntries.length} ${scanAllInstalledDependencies ? "production and development" : "production"} dependency licenses.`,
    `${report.summary.explicitSelections} explicit policy selection(s) verified.`,
    `Report written to ${relative(rootDir, reportPath)}.`,
  ].join(" "),
);
