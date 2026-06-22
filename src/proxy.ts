import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

// The Vaayu product (the dashboard) is served on its own subdomain. On this host
// the root is mapped onto the existing /dashboard routes — URLs keep the
// /dashboard prefix internally, so every existing <Link href="/dashboard/…"> and
// the relative /api/* proxy keep working untouched. Auth carries over for free:
// Clerk cookies are scoped to .sapybase.com. The whole subdomain is marked
// noindex so the app isn't indexed alongside the marketing site.
const APP_HOST = 'vaayu.sapybase.com';

export const proxy = clerkMiddleware(async (auth, req) => {
  const host = req.headers.get('host');
  const isAppHost = host === APP_HOST;
  const { pathname, search } = req.nextUrl;

  // Consolidate the product onto the subdomain: any /dashboard request that
  // arrives on the marketing host (www / apex) is sent to vaayu.sapybase.com,
  // so every relative <Link href="/dashboard/…"> (navbar, hero, post-sign-in
  // redirect, etc.) ends up on the product domain without per-link edits. Auth
  // carries over (cookies on .sapybase.com). Guarded to the production domain so
  // localhost and *.vercel.app preview deployments still serve /dashboard inline.
  if (!isAppHost && host?.endsWith('sapybase.com') && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL(`${pathname}${search}`, `https://${APP_HOST}`), 308);
  }

  // Land the subdomain root on the dashboard. Sign-in / sign-up / sso-callback
  // and existing /dashboard paths are left as-is so the auth flow still works.
  const landOnDashboard = isAppHost && pathname === '/';

  if (isProtectedRoute(req) || landOnDashboard) {
    await auth.protect();
  }

  if (isAppHost) {
    const res = landOnDashboard
      ? NextResponse.rewrite(new URL('/dashboard', req.url))
      : NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }
});

export const config = {
  matcher: [
    // Skip Next internals, static files, and the public embed route
    '/((?!_next|embed|.*\\..*).*)',
    '/(api|trpc)(.*)',
  ],
};
