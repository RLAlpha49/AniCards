/**
 * Console output with one prefix shape.
 *
 * Call sites pass a short scope label (`"Cards API"`, a card id, a script name)
 * and a message. The module supplies the level marker and prefix, so every log
 * line reads `[level] [scope] message` and the level decides the console method.
 *
 * This module is safe in the browser graph: it has no Node built-ins and no
 * `server-only` import, so client components log the same way as routes.
 *
 * @source
 */

type LogMethod = "debug" | "info" | "log" | "warn" | "error";

function write(
  method: LogMethod,
  scope: string,
  message: string,
  args: unknown[],
): void {
  const prefix = `[${method}] [${scope}]`;
  console[method](`${prefix} ${message}`, ...args);
}

/**
 * Create a logger bound to one scope label.
 * @param scope - Short label naming the caller, for example `"Cards API"`.
 * @returns Object with one method per console level.
 * @source
 */
export function createLogger(scope: string) {
  return {
    debug: (message: string, ...args: unknown[]) =>
      write("debug", scope, message, args),
    info: (message: string, ...args: unknown[]) =>
      write("info", scope, message, args),
    log: (message: string, ...args: unknown[]) =>
      write("log", scope, message, args),
    warn: (message: string, ...args: unknown[]) =>
      write("warn", scope, message, args),
    error: (message: string, ...args: unknown[]) =>
      write("error", scope, message, args),
  };
}

/**
 * Logger for callers that do not have their own scope label.
 * @source
 */
export const logger = createLogger("app");

/**
 * Log a message against a scope label chosen at call time.
 *
 * Use this where one module serves several endpoints and the caller, not the
 * module, knows which one is running.
 *
 * @param level - Console level to write at.
 * @param scope - Label for this call, for example a route's friendly name.
 * @param message - Text to log.
 * @param args - Values appended after the message.
 * @source
 */
export function logWith(
  level: LogMethod,
  scope: string,
  message: string,
  ...args: unknown[]
): void {
  write(level, scope, message, args);
}
