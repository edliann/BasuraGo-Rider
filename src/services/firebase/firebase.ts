import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore';
import {
  connectAuthEmulator,
  getReactNativePersistence,
  getAuth,
  initializeAuth,
  setPersistence,
} from 'firebase/auth';
import {
  connectFunctionsEmulator,
  getFunctions,
} from 'firebase/functions';

const useFirebaseEmulators =
  process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
const firebaseEmulatorHost =
  process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST?.trim();

if (useFirebaseEmulators && !__DEV__) {
  throw new Error('Firebase emulators can only be enabled in development builds.');
}
if (useFirebaseEmulators && !firebaseEmulatorHost) {
  throw new Error('EXPO_PUBLIC_FIREBASE_EMULATOR_HOST is required when Firebase emulators are enabled.');
}

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().find((candidate) =>
  candidate.name === '[DEFAULT]') ?? initializeApp(firebaseConfig);

const nativePersistence = getReactNativePersistence(AsyncStorage);
let authPersistenceReady: Promise<void> = Promise.resolve();
const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: nativePersistence,
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'auth/already-initialized'
    ) {
      const existingAuth = getAuth(app);
      authPersistenceReady = setPersistence(
        existingAuth,
        nativePersistence,
      );
      return existingAuth;
    }
    throw error;
  }
})();
const db = getFirestore(app);
const functions = getFunctions(app, 'us-central1');

if (useFirebaseEmulators && firebaseEmulatorHost) {
  connectAuthEmulator(auth, `http://${firebaseEmulatorHost}:9099`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, firebaseEmulatorHost, 8085);
  connectFunctionsEmulator(functions, firebaseEmulatorHost, 5001);
}

export { app, auth, authPersistenceReady, db };

export default app;
