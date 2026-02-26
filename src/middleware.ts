import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

// Define which paths are public (don't require authentication)
const publicPaths = ['/admin/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the path is an admin path
  if (pathname.startsWith('/admin')) {
    const session = await getSession();

    // If the path is public and the user is logged in, redirect to the dashboard
    if (publicPaths.includes(pathname) && session?.admin) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    // If the path is protected and the user is not logged in, redirect to login
    if (!publicPaths.includes(pathname) && !session?.admin) {
      // Clear invalid cookie if it exists and redirect to login
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      if (request.cookies.has('session')) {
        response.cookies.delete('session');
      }
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths under /admin, including the root
  matcher: ['/admin/:path*'],
};
