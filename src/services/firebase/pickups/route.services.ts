import {getFunctions, httpsCallable} from 'firebase/functions';

import firebaseApp from '../firebase';

export interface PickupRouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface PickupRoute {
  encodedPolyline: string;
  distanceMeters: number;
  durationSeconds: number;
}

const functions = getFunctions(firebaseApp, 'us-central1');
const getPickupRouteCallable = httpsCallable<
  {pickupId: string; origin: PickupRouteCoordinate},
  PickupRoute
>(functions, 'getPickupRouteFunction');

export async function getPickupRoute(
  pickupId: string,
  origin: PickupRouteCoordinate,
): Promise<PickupRoute> {
  const result = await getPickupRouteCallable({pickupId, origin});
  return result.data;
}
