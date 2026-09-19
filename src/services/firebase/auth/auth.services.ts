import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  type User,
} from 'firebase/auth';

import {
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import app, { auth, db } from '../firebase';

import { createRiderApplication } from '../riders/verification.services';

export async function login(
  email: string,
  password: string,
): Promise<User> {
  const userCredential =
    await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );

  return userCredential.user;
}

export async function registerRider(
  fullName: string,
  email: string,
  password: string,
  phoneNumber: string,
): Promise<User> {
  const userCredential =
    await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );

  const user = userCredential.user;

  await updateProfile(user, {
    displayName: fullName.trim(),
  });

  await setDoc(doc(db, 'users', user.uid), {
    fullName: fullName.trim(),
    email: email.trim(),
    phoneNumber: phoneNumber.trim(),

    role: 'pending',
    status: 'pending',

    createdAt: serverTimestamp(),
  });

  await createRiderApplication(user.uid);

  return user;
}

export async function logout(): Promise<void> {
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

