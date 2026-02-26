import * as admin from 'firebase-admin';

// Re-export db and auth so they are consistently available, even if null.
let db: admin.firestore.Firestore | null = null;
let auth: admin.auth.Auth | null = null;

// This pattern prevents re-initialization during hot-reloads
if (!admin.apps.length) {
    try {
        const serviceAccountB64 = process.env.FIREBASE_SDK;
        
        if (!serviceAccountB64) {
            throw new Error("The FIREBASE_SDK environment variable is missing or empty.");
        }
        
        // Using 'ascii' as per the user's working example.
        const serviceAccountJson = Buffer.from(serviceAccountB64, 'base64').toString('ascii');
        const serviceAccount = JSON.parse(serviceAccountJson);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        
        db = admin.firestore();
        auth = admin.auth();

    } catch (error: any) {
        console.error("[Firebase Admin] SDK initialization error:", error.message);
        if (error.message.includes("FIREBASE_SDK")) {
             // Specific error already logged.
        } else if (error instanceof SyntaxError) {
             console.error("[Firebase Admin] The FIREBASE_SDK value is not a valid Base64 string or the decoded JSON is malformed.");
        }
    }
} else {
    // If already initialized, just get the instances from the default app
    db = admin.firestore();
    auth = admin.auth();
}

export { db, auth };
