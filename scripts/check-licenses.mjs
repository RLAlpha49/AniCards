import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const rootDir = process.cwd();
const policyPath = join(rootDir, "dependency-license-policy.json");
const reportDir = join(rootDir, ".artifacts", "licenses");
const reportPath = join(reportDir, "license-policy-report.json");
const scannerBinaryCandidates = [
  join(rootDir, "node_modules", ".bin", "license-checker-rseidelsohn"),
  join(rootDir, "node_modules", ".bin", "license-checker-rseidelsohn.exe"),
  join(rootDir, "node_modules", ".bin", "license-checker-rseidelsohn.cmd"),
  join(rootDir, "node_modules", ".bin", "license-checker-rseidelsohn.bunx"),
];
const scannerBinaryPath =
  scannerBinaryCandidates.find((candidatePath) => existsSync(candidatePath)) ??
  scannerBinaryCandidates[0];

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
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
const deniedLicenseSubstrings = Array.isArray(policy.denyLicenseSubstrings)
  ? policy.denyLicenseSubstrings
      .filter((token) => typeof token === "string" && token.trim().length > 0)
      .map((token) => token.trim().toUpperCase())
  : [];
const packageLicenseSelections =
  policy.packageLicenseSelections &&
  typeof policy.packageLicenseSelections === "object"
    ? policy.packageLicenseSelections
    : {};

const scanResult = spawnSync(
  scannerBinaryPath,
  ["--production", "--excludePrivatePackages", "--json"],
  {
    cwd: rootDir,
    encoding: "utf8",
    env: process.env,
  },
);

if (scanResult.status !== 0) {
  console.error(
    scanResult.stderr || scanResult.stdout || "License scan failed.",
  );
  process.exit(scanResult.status ?? 1);
}

const scanOutputText = scanResult.stdout?.trim() || "{}";
const scanOutput = JSON.parse(scanOutputText);
const packageEntries = Object.entries(scanOutput).map(
  ([packageSpec, metadata]) => {
    const packageSelection = packageLicenseSelections[packageSpec];
    const licenseExpression = normalizeLicenseExpression(
      metadata?.licenses ?? metadata?.license,
    );
    const uppercaseExpression = licenseExpression.toUpperCase();
    const hasDeniedLicenseSubstring = deniedLicenseSubstrings.some((token) =>
      uppercaseExpression.includes(token),
    );
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
        !uppercaseExpression.includes(
          packageSelection.selectedLicense.trim().toUpperCase(),
        )
      ) {
        violations.push(
          `Selected license ${packageSelection.selectedLicense} is not present in the observed expression ${licenseExpression || "<empty>"}.`,
        );
      }
    }

    if (hasDeniedLicenseSubstring && !packageSelection) {
      violations.push(
        `Denied license substring requires an explicit policy selection: ${licenseExpression || "<empty>"}.`,
      );
    }

    const { name, version } = splitPackageSpec(packageSpec);

    return {
      packageSpec,
      name,
      version,
      licenseExpression,
      repository:
        metadata && typeof metadata.repository === "string"
          ? metadata.repository
          : undefined,
      path:
        metadata && typeof metadata.path === "string"
          ? metadata.path
          : undefined,
      policySelection: packageSelection ?? null,
      status:
        violations.length > 0
          ? "violation"
          : packageSelection
            ? "allowed-by-policy"
            : "allowed",
      violations,
    };
  },
);

mkdirSync(reportDir, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  policyVersion: policy.version ?? 1,
  scanner: {
    name: "license-checker-rseidelsohn",
    command: [
      relative(rootDir, scannerBinaryPath),
      "--production",
      "--excludePrivatePackages",
      "--json",
    ],
  },
  summary: {
    totalPackages: packageEntries.length,
    deniedLicenseSubstrings,
    explicitSelections: packageEntries.filter(
      (entry) => entry.status === "allowed-by-policy",
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
    `Checked ${packageEntries.length} production dependency licenses.`,
    `${report.summary.explicitSelections} explicit policy selection(s) verified.`,
    `Report written to ${relative(rootDir, reportPath)}.`,
  ].join(" "),
);
