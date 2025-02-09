import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	const path = request.nextUrl.pathname;
	const params = request.nextUrl.searchParams;

	// Redirect /user without params to lookup
	if (path === "/user" && !params.get("userId")) {
		return NextResponse.redirect(new URL("/user/lookup", request.url));
	}

	return NextResponse.next();
}
