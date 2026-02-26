import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { createSession } from '@/lib/session';

export async function POST(request: NextRequest) {
    const authorization = request.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
        const idToken = authorization.split('Bearer ')[1];
        try {
            const decodedToken = await auth.verifyIdToken(idToken);

            // Check for admin custom claim
            if (decodedToken.admin !== true) {
                return NextResponse.json({ error: 'Unauthorized: User is not an admin.' }, { status: 403 });
            }

            // Create a session cookie
            await createSession(decodedToken.uid, { admin: true });

            return NextResponse.json({ status: 'success' }, { status: 200 });

        } catch (error) {
            console.error("Session login error:", error);
            return NextResponse.json({ error: 'Unauthorized: Invalid token.' }, { status: 401 });
        }
    }
    return NextResponse.json({ error: 'Unauthorized: No token provided.' }, { status: 401 });
}
