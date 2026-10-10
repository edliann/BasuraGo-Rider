
import {
  doc,
  GeoPoint,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import app from '../firebase';

const db = getFirestore(app);

export async function saveRiderLocation(
  riderId: string,
  latitude: number,
  longitude: number,
  accuracy: number | null,
): Promise<string> {
  const locationRef = doc(
    db,
    'riders',
    riderId,
    'location',
    'current',
  );

  await setDoc(
    locationRef,
    {
      location: new GeoPoint(latitude, longitude),
      accuracy,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return locationRef.id;
}
