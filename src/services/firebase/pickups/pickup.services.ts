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

  return snapshot.docs
    .filter((pickupDoc) => {
      const data = pickupDoc.data();
      return typeof data.facilityId === 'string' &&
        typeof data.facilityName === 'string' &&
        typeof data.facilityAddress === 'string';
    })
    .map((pickupDoc) => {
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

      facilityId:
        typeof data.facilityId === 'string'
          ? data.facilityId
          : undefined,
      facilityName:
        typeof data.facilityName === 'string'
          ? data.facilityName
          : undefined,
      facilityAddress:
        typeof data.facilityAddress === 'string'
          ? data.facilityAddress
          : undefined,

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

    facilityId:
      typeof data.facilityId === 'string'
        ? data.facilityId
        : undefined,
    facilityName:
      typeof data.facilityName === 'string'
        ? data.facilityName
        : undefined,
    facilityAddress:
      typeof data.facilityAddress === 'string'
        ? data.facilityAddress
        : undefined,

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

      facilityId:
        typeof data.facilityId === 'string'
          ? data.facilityId
          : undefined,
      facilityName:
        typeof data.facilityName === 'string'
          ? data.facilityName
          : undefined,
      facilityAddress:
        typeof data.facilityAddress === 'string'
          ? data.facilityAddress
          : undefined,

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

      facilityId:
        typeof data.facilityId === 'string'
          ? data.facilityId
          : undefined,
      facilityName:
        typeof data.facilityName === 'string'
          ? data.facilityName
          : undefined,
      facilityAddress:
        typeof data.facilityAddress === 'string'
          ? data.facilityAddress
          : undefined,

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