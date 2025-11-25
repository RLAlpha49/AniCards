import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Guards the `/user` route by redirecting to the lookup screen when `userId` is missing.
 * @param request - The incoming Next.js request containing the pathname and query params.
 * @returns A redirect to `/user/lookup` when `userId` is absent, otherwise the original response.
 * @source
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const params = request.nextUrl.searchParams;

  if (path === "/user" && !params.get("userId")) {
    return NextResponse.redirect(new URL("/user/lookup", request.url));
  }

  return NextResponse.next();
}
