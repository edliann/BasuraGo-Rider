import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { getFirestore } from 'firebase/firestore';

import app from '../firebase';

import type {
  RiderApplication,
  RiderApplicationStatus,
} from './verification.types';

const db = getFirestore(app);

export async function createRiderApplication(
  riderId: string,
): Promise<void> {
  const applicationRef = doc(
    db,
    'riderApplications',
    riderId,
  );

  const existingApplication =
    await getDoc(applicationRef);

  if (existingApplication.exists()) {
    return;
  }

  await setDoc(applicationRef, {
    riderId,

    status: 'incomplete',

    basicInformationCompleted: true,
    identityDocumentCompleted: false,
    driversLicenseCompleted: false,
    faceVerificationCompleted: false,
    vehicleInformationCompleted: false,

    submittedAt: null,
    reviewedAt: null,

    rejectionReason: null,
    correctionMessage: null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getRiderApplication(
  riderId: string,
): Promise<RiderApplication | null> {
  const applicationRef = doc(
    db,
    'riderApplications',
    riderId,
  );

  const snapshot =
    await getDoc(applicationRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as RiderApplication;
}

export async function updateRiderApplicationProgress(
  riderId: string,
  updates: Partial<
    Pick<
      RiderApplication,
      | 'identityDocumentCompleted'
      | 'driversLicenseCompleted'
      | 'faceVerificationCompleted'
      | 'vehicleInformationCompleted'
    >
  >,
): Promise<void> {
  const applicationRef = doc(
    db,
    'riderApplications',
    riderId,
  );

  await updateDoc(applicationRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function submitRiderApplication(
  riderId: string,
): Promise<void> {
  const applicationRef = doc(
    db,
    'riderApplications',
    riderId,
  );

  const snapshot = await getDoc(applicationRef);

  if (!snapshot.exists()) {
    throw new Error(
      'Rider application was not found.',
    );
  }

  const application =
    snapshot.data() as RiderApplication;

  if (
    application.status !== 'incomplete' &&
    application.status !== 'needs_correction'
  ) {
    throw new Error(
      'This application cannot be submitted in its current status.',
    );
  }

  const isComplete =
    application.basicInformationCompleted &&
    application.identityDocumentCompleted &&
    application.driversLicenseCompleted &&
    application.faceVerificationCompleted &&
    application.vehicleInformationCompleted;

  if (!isComplete) {
    throw new Error(
      'Please complete all verification requirements before submitting your application.',
    );
  }

  await updateDoc(applicationRef, {
    status: 'submitted',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}