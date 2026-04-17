/**
 * How long to suppress auto-restarting the tour after a user dismisses it.
 *
 * Dismissal is stored as a timestamp under `${tourStorageKey}:dismissed` in
 * localStorage. This cooldown prevents repeatedly auto-showing the tour to users
 * who explicitly closed it.
 */
export const TOUR_DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function shouldAutoStartTour({
  isNewUser,
  isTourCompleted,
  isTourRunning,
  lastDismissedAt,
  nowMs = Date.now(),
  cooldownMs = TOUR_DISMISS_COOLDOWN_MS,
}: {
  isNewUser: boolean;
  isTourCompleted: boolean;
  isTourRunning: boolean;
  lastDismissedAt: number | null;
  nowMs?: number;
  cooldownMs?: number;
}): boolean {
  if (!isNewUser) return false;
  if (isTourCompleted) return false;
  if (isTourRunning) return false;
  if (lastDismissedAt != null && Number.isFinite(lastDismissedAt)) {
    if (nowMs - lastDismissedAt < cooldownMs) return false;
  }
  return true;
}
