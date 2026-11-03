import {
  doc,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import firebaseApp from '../firebase';

import type {
  RiderVehicleInformation,
} from './vehicle-application.types';

const db = getFirestore(firebaseApp);

export async function saveVehicleInformation(
  riderId: string,
  vehicleInformation: RiderVehicleInformation,
): Promise<void> {
  const applicationRef = doc(
    db,
    'riderApplications',
    riderId,
  );

  await updateDoc(applicationRef, {
    vehicleInformation,
    vehicleInformationCompleted: true,
    updatedAt: serverTimestamp(),
  });
}
