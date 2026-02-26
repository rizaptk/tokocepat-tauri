import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import * as nextHeaders from 'next/headers';

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

export async function createSession(uid: string, claims: object) {
  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
  const sessionPayload = { uid, ...claims, expires };
  const session = await encrypt(sessionPayload);

  nextHeaders.cookies().set('session', session, { 
    expires, 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

export async function getSession() {
  const sessionCookie = nextHeaders.cookies().get('session')?.value;
  if (!sessionCookie) return null;
  return await decrypt(sessionCookie);
}

export async function deleteSession() {
  // Set the cookie to an empty value and an expiration date in the past
  nextHeaders.cookies().set('session', '', { httpOnly: true, expires: new Date(0), path: '/' });
}
