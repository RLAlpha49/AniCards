export function logRequest(endpoint: string, ip: string, details?: string): void {
  const message = details
    ? `🚀 [${endpoint}] Incoming request from IP: ${ip} - ${details}`
    : `🚀 [${endpoint}] Incoming request from IP: ${ip}`;
  console.log(message);
}

export function logSuccess(
  endpoint: string,
  userId: number,
  duration: number,
  details?: string,
): void {
  const message = details
    ? `✅ [${endpoint}] ${details} for user ${userId} in ${duration}ms`
    : `✅ [${endpoint}] Successfully processed user ${userId} [${duration}ms]`;
  console.log(message);
}