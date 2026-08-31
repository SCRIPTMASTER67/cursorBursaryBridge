import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'bb_session';

/**
 * Edge-side gate.
 *
 * Only checks whether a session cookie is present — the Prisma-backed session
 * lookup and the role check run in the server components and route handlers
 * (`requireStudent` / `requireCorporate`). This keeps the middleware free of a
 * database round trip while still bouncing anonymous traffic away from the
 * application shell.
 */
const PROTECTED_PREFIXES = ['/student', '/corporate', '/onboarding'];
const AUTH_ONLY_PATHS = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Preserve where the user was heading so login can return them there.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // A signed-in user has no reason to see the login or sign-up screens; the
  // pages themselves redirect to the correct dashboard for their role.
  if (hasSession && AUTH_ONLY_PATHS.some((path) => pathname === path)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals, the API (which authenticates itself and
     * must answer 401 rather than redirect), and static assets.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
