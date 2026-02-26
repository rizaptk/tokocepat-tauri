import { initializeApp, getApps, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

const appName = 'tokocepat'; 

/**
 * Initializes and returns the Firebase Admin App instance.
 * Throws an error if initialization fails.
 */
function initializeAdminApp(): App {
  // Return existing app if already initialized (prevents hot-reload errors)
  const existingApp = getApps().find((app) => app.name === appName);
  if (existingApp) {
    return existingApp;
  }

  // Validate environment variable
  const b64Key = process.env.FIREBASE_SDK;
  if (!b64Key) {
    throw new Error("[Firebase Admin] FATAL: The FIREBASE_SDK environment variable is not set.");
  }

  try {
    // Decode and Parse the service account
    const serviceAccountString = Buffer.from(b64Key, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(serviceAccountString);

    // Format the private key to handle escaped newlines
    const formattedServiceAccount: ServiceAccount = {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
    };

    // Initialize and return the app
    return initializeApp({ credential: cert(formattedServiceAccount) }, appName);

  } catch (error: any) {
    // Provide a detailed error message if parsing or initialization fails
    console.error("[Firebase Admin] Initialization failed:", error.message);
    throw new Error(`[Firebase Admin] Could not initialize app. Please check if the FIREBASE_SDK variable is a valid, Base64-encoded service account key. Original error: ${error.message}`);
  }
}

// Initialize the app. This will throw an error on server start if it fails.
const adminApp = initializeAdminApp();

// Export the initialized services
const db: Firestore = getFirestore(adminApp);
const auth: Auth = getAuth(adminApp);

export { db, auth };
