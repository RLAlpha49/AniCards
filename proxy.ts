import type { NextRequest } from "next/server";

import { middleware } from "@/app/middleware";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

/**
 * Next.js 16 uses the root `proxy.ts` file convention for request interception.
 * Reuse the existing middleware logic so every matched request receives a
 * forwarded request ID, while only HTML routes receive CSP/nonce headers.
 */
export function proxy(request: NextRequest) {
  return middleware(request);
}
