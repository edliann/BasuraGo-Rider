import {
  collection,
  doc,
  getDocs,
  getDoc,
  getFirestore,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';

import app from '../firebase';

import type { Pickup } from './pickup.types';

const db = getFirestore(app);

export async function getAvailablePickups(): Promise<Pickup[]> {
  const pickupsRef = collection(db, 'pickups');

  const pickupsQuery = query(
    pickupsRef,
    where('status', '==', 'pending'),
  );

  const snapshot = await getDocs(pickupsQuery);

  return snapshot.docs.map((pickupDoc) => {
    const data = pickupDoc.data();

    return {
      id: pickupDoc.id,

      customerId: data.customerId ?? '',
      addressId: data.addressId ?? '',
      wasteTypeId: data.wasteTypeId ?? '',

      customerName: data.customerName ?? '',
      pickupAddress: data.pickupAddress ?? '',
      wasteTypeName: data.wasteTypeName ?? '',

      estimatedWeight: data.estimatedWeight ?? 0,
      actualWeight: data.actualWeight ?? null,

      scheduledDate: data.scheduledDate ?? '',
      scheduledTime: data.scheduledTime ?? '',

      status: data.status ?? 'pending',

      riderId: data.riderId ?? null,
      vehicleId: data.vehicleId ?? null,

      notes: data.notes ?? '',

      completedAt: data.completedAt ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });
}

export async function getPickupById(
  pickupId: string,
): Promise<Pickup | null> {
  const pickupRef = doc(
    db,
    'pickups',
    pickupId,
  );

  const snapshot = await getDoc(pickupRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    id: snapshot.id,

    customerId: data.customerId ?? '',
    addressId: data.addressId ?? '',
    wasteTypeId: data.wasteTypeId ?? '',

    customerName: data.customerName ?? '',
    pickupAddress: data.pickupAddress ?? '',
    wasteTypeName: data.wasteTypeName ?? '',

    estimatedWeight: data.estimatedWeight ?? 0,
    actualWeight: data.actualWeight ?? null,

    scheduledDate: data.scheduledDate ?? '',
    scheduledTime: data.scheduledTime ?? '',

    status: data.status ?? 'pending',

    riderId: data.riderId ?? null,
    vehicleId: data.vehicleId ?? null,

    notes: data.notes ?? '',

    completedAt: data.completedAt ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function getMyPickups(
  riderId: string,
): Promise<Pickup[]> {
  const pickupsRef = collection(
    db,
    'pickups',
  );

  const pickupsQuery = query(
    pickupsRef,
    where('riderId', '==', riderId),
  );

  const snapshot =
    await getDocs(pickupsQuery);

  return snapshot.docs.map((pickupDoc) => {
    const data = pickupDoc.data();

    return {
      id: pickupDoc.id,

      customerId:
        data.customerId ?? '',
      addressId:
        data.addressId ?? '',
      wasteTypeId:
        data.wasteTypeId ?? '',

      customerName:
        data.customerName ?? '',
      pickupAddress:
        data.pickupAddress ?? '',
      wasteTypeName:
        data.wasteTypeName ?? '',

      estimatedWeight:
        data.estimatedWeight ?? 0,
      actualWeight:
        data.actualWeight ?? null,

      scheduledDate:
        data.scheduledDate ?? '',
      scheduledTime:
        data.scheduledTime ?? '',

      status:
        data.status ?? 'pending',

      riderId:
        data.riderId ?? null,
      vehicleId:
        data.vehicleId ?? null,

      notes:
        data.notes ?? '',

      completedAt:
        data.completedAt ?? null,
      createdAt:
        data.createdAt,
      updatedAt:
        data.updatedAt,
    };
  });
}

export async function getPickupHistory(
  riderId: string,
): Promise<Pickup[]> {
  const pickupsRef = collection(
    db,
    'pickups',
  );

  const historyQuery = query(
    pickupsRef,
    where('riderId', '==', riderId),
    where('status', '==', 'completed'),
  );

  const snapshot =
    await getDocs(historyQuery);

  return snapshot.docs.map((pickupDoc) => {
    const data = pickupDoc.data();

    return {
      id: pickupDoc.id,

      customerId:
        data.customerId ?? '',
      addressId:
        data.addressId ?? '',
      wasteTypeId:
        data.wasteTypeId ?? '',

      customerName:
        data.customerName ?? '',
      pickupAddress:
        data.pickupAddress ?? '',
      wasteTypeName:
        data.wasteTypeName ?? '',

      estimatedWeight:
        data.estimatedWeight ?? 0,
      actualWeight:
        data.actualWeight ?? null,

      scheduledDate:
        data.scheduledDate ?? '',
      scheduledTime:
        data.scheduledTime ?? '',

      status:
        data.status ?? 'completed',

      riderId:
        data.riderId ?? null,
      vehicleId:
        data.vehicleId ?? null,

      notes:
        data.notes ?? '',

      completedAt:
        data.completedAt ?? null,
      createdAt:
        data.createdAt,
      updatedAt:
        data.updatedAt,
    };
  });
}

export async function acceptPickup(
  pickupId: string,
  riderId: string,
  vehicleId: string,
): Promise<void> {
  const pickupRef = doc(
    db,
    'pickups',
    pickupId,
  );

  const riderRef = doc(
    db,
    'riders',
    riderId,
  );

  await runTransaction(
    db,
    async (transaction) => {
      const pickupSnapshot =
        await transaction.get(
          pickupRef,
        );

      const riderSnapshot =
        await transaction.get(
          riderRef,
        );

      if (!pickupSnapshot.exists()) {
        throw new Error(
          'Pickup not found.',
        );
      }

      if (!riderSnapshot.exists()) {
        throw new Error(
          'Rider profile not found.',
        );
      }

      const pickupData =
        pickupSnapshot.data();

      const riderData =
        riderSnapshot.data();

      if (
        pickupData.status !==
        'pending'
      ) {
        throw new Error(
          'This pickup is no longer available.',
        );
      }

      if (
        riderData.status !==
        'active'
      ) {
        throw new Error(
          'Your rider account is not active.',
        );
      }

      if (
        riderData.vehicleId !==
        vehicleId
      ) {
        throw new Error(
          'This vehicle is not assigned to you.',
        );
      }

      transaction.update(
        pickupRef,
        {
          riderId,
          vehicleId,
          status: 'accepted',
          updatedAt:
            serverTimestamp(),
        },
      );
    },
  );
}

export async function startPickup(
  pickupId: string,
  riderId: string,
): Promise<void> {
  const pickupRef = doc(
    db,
    'pickups',
    pickupId,
  );

  await runTransaction(
    db,
    async (transaction) => {
      const pickupSnapshot =
        await transaction.get(
          pickupRef,
        );

      if (!pickupSnapshot.exists()) {
        throw new Error(
          'Pickup not found.',
        );
      }

      const pickupData =
        pickupSnapshot.data();

      if (
        pickupData.riderId !==
        riderId
      ) {
        throw new Error(
          'This pickup is not assigned to you.',
        );
      }

      if (
        pickupData.status !==
        'accepted'
      ) {
        throw new Error(
          'This pickup cannot be started.',
        );
      }

      transaction.update(
        pickupRef,
        {
          status: 'in_progress',
          updatedAt:
            serverTimestamp(),
        },
      );
    },
  );
}

export async function completePickup(
  pickupId: string,
  riderId: string,
): Promise<void> {
  const pickupRef = doc(
    db,
    'pickups',
    pickupId,
  );

  await runTransaction(
    db,
    async (transaction) => {
      const pickupSnapshot =
        await transaction.get(
          pickupRef,
        );

      if (!pickupSnapshot.exists()) {
        throw new Error(
          'Pickup not found.',
        );
      }

      const pickupData =
        pickupSnapshot.data();

      if (
        pickupData.riderId !==
        riderId
      ) {
        throw new Error(
          'This pickup is not assigned to you.',
        );
      }

      if (
        pickupData.status !==
        'in_progress'
      ) {
        throw new Error(
          'This pickup cannot be completed.',
        );
      }

      transaction.update(
        pickupRef,
        {
          status: 'completed',
          completedAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        },
      );
    },
  );
}