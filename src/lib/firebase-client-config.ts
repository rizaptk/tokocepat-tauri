// IMPORTANT: A new .env variable is required for this to work.
// Add the following to your .env file and replace with your Firebase project's web app config:
// NEXT_PUBLIC_FIREBASE_CONFIG='{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}'

let clientConfig: any = null;

try {
    const configEnv = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
    if (configEnv) {
        clientConfig = JSON.parse(configEnv);
    }
} catch (e) {
    console.error("Could not parse NEXT_PUBLIC_FIREBASE_CONFIG. Please check your .env file.");
}

if (!clientConfig || !clientConfig.apiKey) {
    console.warn("Firebase client config is not set up correctly in NEXT_PUBLIC_FIREBASE_CONFIG environment variable. Some features may not work.");
}

export const firebaseClientConfig = clientConfig;
