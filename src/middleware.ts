import createMiddleware from 'next-intl/middleware';
import {pathnames, locales, localePrefix} from './config';

export default createMiddleware({
  defaultLocale: 'en',
  locales,
  pathnames,
  localePrefix,
  localeDetection: true,
});

export const config = {
  matcher: [
    // Enable a redirect to a matching locale at the root
    '/',

    // Apply locale handling to pages, but let both root and locale-scoped APIs
    // reach their Route Handlers directly without an internal proxy rewrite.
    '/((?!api|en/api|zh/api|ja/api|_next|_vercel|.*\\..*).*)'
  ]
};
