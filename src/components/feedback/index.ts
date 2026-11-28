/**
 * Feedback surfaces, selected under `@/components/feedback`.
 *
 * The barrel lists what other folders import: the boundary every page wraps in,
 * the popup the generator reports through, and the spinner a page shows while
 * it loads. `LoadingOverlay` is a sibling that only `LoadingSpinner` uses, so it
 * is not part of this interface.
 *
 * @source
 */
export { ErrorBoundary, type ErrorBoundaryProps } from "./ErrorBoundary";
export { ErrorPopup } from "./ErrorPopup";
export { LoadingSpinner } from "./LoadingSpinner";
