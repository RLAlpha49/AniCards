/** @type {import('ts-jest').JestConfigWithTsJest} **/
export const preset = "ts-jest";
export const testEnvironment = "node";
export const moduleNameMapper = {
  "^@/(.*)$": "<rootDir>/$1",
};
export const silent = true;
export const reporters = ["<rootDir>/custom-reporter.js", "summary"];
