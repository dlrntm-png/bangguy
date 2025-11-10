import { NextResponse } from 'next/server';

const BLOB_DOMAINS = [
  'https://*.vercel-storage.com',
  'https://*.blob.vercel-storage.com',
  'https://*.public.blob.vercel-storage.com'
];

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-XSS-Protection': '0',
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    `img-src 'self' data: blob: ${BLOB_DOMAINS.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${BLOB_DOMAINS.join(' ')}`,
    "font-src 'self'",
    "frame-ancestors 'none'"
  ].join('; ')
};

export function middleware(req) {
  const res = NextResponse.next();
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    res.headers.set(key, value);
  });
  return res;
}

export const config = {
  matcher: ['/admin.html', '/api/:path*']
};

