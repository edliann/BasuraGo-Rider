import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import {
  getAuth,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  getStorage,
  connectStorageEmulator,
} from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

if (__DEV__) {
  const emulatorHost =
    process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ||
    'localhost';

  connectAuthEmulator(
    auth,
    `http://${emulatorHost}:9099`,
  );

  connectFirestoreEmulator(
    db,
    emulatorHost,
    8082,
  );

  connectStorageEmulator(
    storage,
    emulatorHost,
    9199,
  );
}

export { app, auth, db, storage };

export default app;