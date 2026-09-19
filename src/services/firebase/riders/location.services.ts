import {
  collection,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import app from '../firebase';

import type { RiderLocation } from './location.types';

const db = getFirestore(app);

export async function saveRiderLocation(
  riderId: string,
  latitude: number,
  longitude: number,
  accuracy: number | null,
): Promise<string> {
  const locationRef = doc(
    collection(
      db,
      'riders',
      riderId,
      'location',
    ),
  );

  const location: Omit<
    RiderLocation,
    'id'
  > = {
    latitude,
    longitude,
    accuracy,
    timestamp: serverTimestamp(),
  };

  await setDoc(
    locationRef,
    location,
  );

  return locationRef.id;
}