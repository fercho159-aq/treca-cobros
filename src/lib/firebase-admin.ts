import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let app: App;

if (getApps().length === 0) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccount) {
    app = initializeApp({
      credential: cert(JSON.parse(serviceAccount)),
      projectId: "treca-d1169",
    });
  } else {
    // Fallback for local dev - uses GOOGLE_APPLICATION_CREDENTIALS env var
    app = initializeApp({ projectId: "treca-d1169" });
  }
} else {
  app = getApps()[0];
}

export const adminDb = getFirestore(app);
