
import { getFunctions, httpsCallable } from 'firebase/functions';

import firebaseApp, {auth} from '../firebase';

const functions = getFunctions(firebaseApp, 'us-central1');
const publishRiderLocation = httpsCallable<
  {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    locationTimestamp?: number;
  },
  { success: true }
>(functions, 'publishRiderLocationFunction');

export async function saveRiderLocation(
  riderId: string,
  latitude: number,
  longitude: number,
  accuracy: number | null,
  locationTimestamp = Date.now(),
): Promise<string> {
  if (!riderId || auth.currentUser?.uid !== riderId) {
    throw new Error('Only the signed-in rider can publish this location.');
  }
  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) {
    throw new Error('A valid GPS coordinate is required.');
  }

  await publishRiderLocation({
    latitude,
    longitude,
    accuracy,
    locationTimestamp,
  });
  return 'current';
}
