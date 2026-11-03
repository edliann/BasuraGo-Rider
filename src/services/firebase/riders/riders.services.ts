import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import firebaseApp from '../firebase';

import type {
  Rider,
} from './riders.types';

const db = getFirestore(firebaseApp);

export async function getRider(
  riderId: string,
): Promise<Rider | null> {
  const riderRef = doc(
    db,
    'riders',
    riderId,
  );

  const snapshot =
    await getDoc(riderRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data =
    snapshot.data();

  return {
    id: snapshot.id,

    fullName:
      data.fullName ?? '',

    phoneNumber:
      data.phoneNumber ?? '',

    status:
      data.status ?? 'pending',

    vehicleId:
      data.vehicleId ?? null,

    isOnline:
      data.isOnline ?? false,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

export async function updateRiderOnlineStatus(
  riderId: string,
  isOnline: boolean,
): Promise<void> {
  const riderRef = doc(
    db,
    'riders',
    riderId,
  );

  await updateDoc(riderRef, {
    isOnline,
    updatedAt: serverTimestamp(),
  });
}

export async function updateRiderProfile(
  riderId: string,
  data: { fullName: string; phoneNumber: string },
): Promise<void> {
  const riderRef = doc(db, 'riders', riderId);

  await updateDoc(riderRef, {
    fullName: data.fullName.trim(),
    phoneNumber: data.phoneNumber.trim(),
    updatedAt: serverTimestamp(),
  });
}
