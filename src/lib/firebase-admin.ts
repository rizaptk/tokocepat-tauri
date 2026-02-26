import * as admin from 'firebase-admin';

// Check if the app is already initialized to prevent errors during hot-reloads
if (!admin.apps.length) {
    try {
        // Use FIREBASE_SDK for the private key as requested by the user
        const privateKey = process.env.FIREBASE_SDK
            ? Buffer.from(process.env.FIREBASE_SDK, 'base64').toString('utf8')
            : undefined;
        
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

        if (!privateKey || !projectId || !clientEmail) {
            const missingVars: string[] = [];
            if (!projectId) missingVars.push('FIREBASE_PROJECT_ID');
            if (!clientEmail) missingVars.push('FIREBASE_CLIENT_EMAIL');
            if (!privateKey) missingVars.push('FIREBASE_SDK');
            console.warn(`Firebase Admin SDK not initialized. Missing environment variables: ${missingVars.join(', ')}`);
        } else {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
        }
    } catch (error: any) {
        console.error("Firebase Admin SDK initialization error:", error.message);
    }
}

// Safely get db and auth instances. They will be null if initialization failed.
const db = admin.apps.length ? admin.firestore() : null;
const auth = admin.apps.length ? admin.auth() : null;

export { db, auth };
