import { clerkMiddleware } from '@clerk/nextjs/server';

// Single auth boundary for all app routes. Keep sign-in/up and public assets open.
export default clerkMiddleware({
  publicRoutes: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/clerk(.*)',
    '/favicon.ico',
    '/robots.txt',
    '/manifest.webmanifest',
    '/(public)(.*)',
  ],
});

export const config = {
  matcher: [
    '/((?!.+\\.[\\w]+$|_next).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};
