import type { NextRequest } from "next/server";

import { middleware } from "@/app/middleware";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

/**
 * Next.js 16 uses the root `proxy.ts` file convention for request interception.
 * Reuse the existing CSP/nonce middleware logic so HTML routes receive the same
 * security headers and forwarded request nonce in live app behavior.
 */
export function proxy(request: NextRequest) {
  return middleware(request);
}
