import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Get current path and query parameters from URL
  const path = request.nextUrl.pathname;
  const params = request.nextUrl.searchParams;

  /*
   * Redirect logic for /user route:
   * - When accessing /user without a userId parameter
   * - Prevents direct access to user page without valid ID
   * - Redirects to user lookup page for input
   */
  if (path === "/user" && !params.get("userId")) {
    return NextResponse.redirect(new URL("/user/lookup", request.url));
  }

  // No redirect needed - continue with normal request flow
  return NextResponse.next();
}
