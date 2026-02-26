import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session')?.value;

  // If trying to access login page with a valid session, redirect to dashboard
  if (pathname === '/admin/login' && sessionCookie) {
    const session = await decrypt(sessionCookie);
    if (session) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // Protect all other admin routes
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    const session = await decrypt(sessionCookie);
    if (!session) {
      // Clear invalid cookie and redirect to login
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.delete('session');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
