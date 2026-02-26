import * as admin from 'firebase-admin';

// Re-export db and auth so they are consistently available, even if null.
let db: admin.firestore.Firestore | null = null;
let auth: admin.auth.Auth | null = null;


// Check if the app is already initialized to prevent errors during hot-reloads
if (!admin.apps.length) {
    try {
        const serviceAccountB64 = process.env.FIREBASE_SDK;
        
        if (serviceAccountB64) {
            const serviceAccountJson = Buffer.from(serviceAccountB64, 'base64').toString('utf8');
            const serviceAccount = JSON.parse(serviceAccountJson);

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            
            db = admin.firestore();
            auth = admin.auth();
        } else {
            // This warning is helpful for the user to know what to do.
            console.warn(`Firebase Admin SDK not initialized. The FIREBASE_SDK environment variable is missing or empty.`);
        }
    } catch (error: any) {
        console.error("Firebase Admin SDK initialization error:", error.message);
        if (error.message.includes('Failed to parse private key')) {
             console.error("The private key in your service account JSON is malformed.");
        } else if (error instanceof SyntaxError) {
             console.error("The FIREBASE_SDK value is not a valid Base64 string or the decoded JSON is malformed.");
        }
    }
} else {
    // If already initialized, just get the instances
    db = admin.firestore();
    auth = admin.auth();
}


export { db, auth };
