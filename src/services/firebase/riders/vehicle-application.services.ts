import {
  doc,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import app from '../firebase';

import type {
  RiderVehicleInformation,
} from './vehicle-application.types';

const db = getFirestore(app);

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