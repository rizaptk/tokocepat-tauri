import * as admin from 'firebase-admin';

// Check if the app is already initialized to prevent errors during hot-reloads
if (!admin.apps.length) {
    try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY
            ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY, 'base64').toString('utf8')
            : undefined;
            
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey,
            }),
        });
    } catch (error: any) {
        console.error("Firebase Admin SDK initialization error:", error.message);
    }
}

const db = admin.firestore();
const auth = admin.auth();

export { db, auth };
