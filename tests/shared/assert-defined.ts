/**
 * Asserts that a test value is defined and narrows away nullish types.
 *
 * @template T - The non-nullable value type being asserted.
 * @param value - Value to check for nullishness.
 * @param msg - Error message to throw when `value == null`.
 * @returns void - Type is narrowed via assertion signature.
 * @throws {Error} When `value == null`.
 *
 * @remarks
 * Used in tests to narrow values after setup or runtime initialization.
 *
 * @example
 * const fit = resolveSvgTitleTextFit({ maxWidth: 120, text: title });
 * assertDefined(fit);
 * expect(fit.text).toContain("Title");
 */
export function assertDefined<T>(
  value: T | null | undefined,
  msg = "Expected value to be defined",
): asserts value is T {
  if (value == null) {
    throw new Error(msg);
  }
}
