import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized: No token provided.' }, { status: 401 });
    }
    
    const idToken = authorization.split('Bearer ')[1];
    
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        
        if (decodedToken.admin === true) {
            return NextResponse.json({ isAdmin: true }, { status: 200 });
        } else {
            return NextResponse.json({ isAdmin: false, error: 'User is not an admin.' }, { status: 403 });
        }

    } catch (error) {
        console.error("Token verification error:", error);
        return NextResponse.json({ isAdmin: false, error: 'Invalid or expired token.' }, { status: 401 });
    }
}
