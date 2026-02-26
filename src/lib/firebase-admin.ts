import { initializeApp, getApps, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

const appName = 'tokocepat';

/**
 * Helper to initialize the app instance once.
 * Decodes the base64 service account from the environment.
 */
function initializeAdmin(): App | null {
  // 1. Return existing app if already initialized (prevents hot-reload errors)
  const existingApp = getApps().find((app) => app.name === appName);
  if (existingApp) return existingApp;

  // 2. Validate environment variable
  const b64Key = process.env.FIREBASE_SDK;
  if (!b64Key) {
    console.error(`[Firebase Admin] Missing FIREBASE_SERVICE_ACCOUNT_KEY`);
    return null;
  }

  try {
    // 3. Decode and Parse
    const serviceAccount = JSON.parse(
      Buffer.from(b64Key, 'base64').toString('utf8')
    );

    // Ensure the private_key specifically handles escaped newlines
    const formattedServiceAccount: ServiceAccount = {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
    };

    return initializeApp(
      { credential: cert(formattedServiceAccount) },
      appName
    );
  } catch (error) {
    console.error(`[Firebase Admin] Initialization failed:`, error);
    return null;
  }
}

// Initialize the app
const app = initializeAdmin();

// Initialize and export lowercase db and auth
// These will be null if initialization failed.
const db: Firestore | null = app ? getFirestore(app) : null;
const auth: Auth | null = app ? getAuth(app) : null;

export { db, auth };