/**
 * The error type API routes throw and catch.
 *
 * `ApiError` carries the HTTP status and the JSON body a route returns, so a
 * thrown error and a returned error response describe the same failure.
 * @source
 */
/**
 * Standardized API error response shape returned from API routes.
 * @source
 */
export interface ApiError {
  error: string;
}
