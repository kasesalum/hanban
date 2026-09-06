import admin from "firebase-admin";
import { readFileSync } from "fs";
import "dotenv/config";

const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf-8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET ||
    `${serviceAccount.project_id}.appspot.com`,
});

export const db = admin.firestore();

export function getBucket() {
  try {
    return admin.storage().bucket();
  } catch (err) {
    console.error("Firebase Storage is not available:", err);
    return null;
  }
}
