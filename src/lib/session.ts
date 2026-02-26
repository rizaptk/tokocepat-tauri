import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
    throw new Error('SESSION_SECRET environment variable is not set');
}
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.SESSION_EXPIRATION || '2h')
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    // This catches expired tokens or invalid signatures
    return null;
  }
}

export async function createSession(userId: string) {
  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
  const session = await encrypt({ userId, expires });

  cookies().set('session', session, { 
    expires, 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

export async function getSession() {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) return null;
  return await decrypt(sessionCookie);
}

export async function deleteSession() {
  cookies().delete('session');
}

export async function updateSession(request: NextRequest) {
    const session = request.cookies.get('session')?.value
    if (!session) return
  
    // Refresh the session so it doesn't expire
    const parsed = await decrypt(session)
    if (parsed) {
        parsed.expires = new Date(Date.now() + 2 * 60 * 60 * 1000)
        const res = NextResponse.next()
        res.cookies.set({
          name: 'session',
          value: await encrypt(parsed),
          httpOnly: true,
          expires: parsed.expires,
        })
        return res
    }
}
