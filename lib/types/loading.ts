/**
 * Shared LoadingPhase type used across user loading/setup flows.
 */
export type LoadingPhase =
  | "idle"
  | "checking"
  | "setting_up"
  | "fetching_anilist"
  | "saving"
  | "loading_cards"
  | "complete"
  | "error";
