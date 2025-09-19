// Define helper functions for coloring text using ANSI escape codes.
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;

class CustomReporter {
  constructor(globalConfig, options) {
    // Save config and options if necessary
    this._globalConfig = globalConfig;
    this._options = options;
  }

  // Called after each test file is executed
  onTestResult(test, testResult) {
    // Get a relative path for easier reading
    const relativePath = testResult.testFilePath.replace(
      process.cwd() + "/",
      "",
    );
    const isFailure =
      testResult.testExecError || testResult.numFailingTests > 0;
    const statusLabel = isFailure ? red("FAIL") : green("PASS");
    console.log(`${statusLabel}  ${relativePath}`);

    // If there are individual test results, iterate over them; otherwise output execution error details.
    if (testResult.testResults && testResult.testResults.length > 0) {
      testResult.testResults.forEach((assertionResult) => {
        // Use a green check mark for passed tests,
        // use red for failed or pending tests.
        let failSymbol = assertionResult.status === "pending" ? "-" : "✕";
        const symbol =
          assertionResult.status === "passed" ? green("√") : red(failSymbol);

        // Concatenate ancestor titles (the describe blocks) and test title
        const fullTitle =
          assertionResult.ancestorTitles.length > 0
            ? `${assertionResult.ancestorTitles.join(" ")} ${assertionResult.title}`
            : assertionResult.title;

        console.log(
          `  ${symbol} ${fullTitle} (${assertionResult.duration || 0} ms)`,
        );
      });
    } else if (testResult.testExecError && testResult.failureMessage) {
      console.log(red("Test execution error:"));
      console.log(testResult.failureMessage);
    }

    // For debugging purposes, print the console output, only when silent is false
    if (
      !this._globalConfig.silent &&
      testResult.console &&
      testResult.console.length > 0
    ) {
      console.log("Console output:");
      testResult.console.forEach((entry) => {
        console.log(entry.message);
      });
    }

    // Add an extra newline between files
    console.log("");
  }
}

module.exports = CustomReporter;
