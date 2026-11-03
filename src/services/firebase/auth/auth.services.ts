import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type User,
} from 'firebase/auth';

import { auth, authPersistenceReady } from '../firebase';
import {stopRiderBackgroundLocation} from '../../location/riderBackgroundLocationTask';
import {updateRiderOnlineStatus} from '../riders/riders.services';

export async function login(
  email: string,
  password: string,
): Promise<User> {
  await authPersistenceReady;

  const userCredential =
    await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );

  return userCredential.user;
}

export async function logout(): Promise<void> {
  const riderId = auth.currentUser?.uid;
  if (riderId) {
    try {
      await stopRiderBackgroundLocation();
    } catch (error) {
      console.warn('Unable to stop background location during sign out:', error);
    }
    try {
      await updateRiderOnlineStatus(riderId, false);
    } catch (error) {
      console.warn('Unable to set rider offline during sign out:', error);
    }
  }
  await signOut(auth);
}

export async function resetPassword(
  email: string,
): Promise<void> {
  await sendPasswordResetEmail(
    auth,
    email.trim(),
  );
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export { auth };
