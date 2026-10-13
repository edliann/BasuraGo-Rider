import {
  collection, doc, getDocs, getDoc, getFirestore, query,
  runTransaction, serverTimestamp, where,
} from 'firebase/firestore';
import app from '../firebase';
import type { Pickup } from './pickup.types';
import {
  MOCK_PICKUP_MODE, getMockPickups, getMockPickupById, updateMockPickup,
} from '../../../dev/mockPickups';

const db = getFirestore(app);

function mapPickup(id: string, data: Record<string, any>): Pickup {
  return {
    id,
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
    facilityId: typeof data.facilityId === 'string' ? data.facilityId : undefined,
    facilityName: typeof data.facilityName === 'string' ? data.facilityName : undefined,
    facilityAddress: typeof data.facilityAddress === 'string' ? data.facilityAddress : undefined,
    riderId: data.riderId ?? null,
    vehicleId: data.vehicleId ?? null,
    notes: data.notes ?? '',
    completedAt: data.completedAt ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function getAvailablePickups(): Promise<Pickup[]> {
  if (MOCK_PICKUP_MODE) return getMockPickups('demo-rider').available;
  const snapshot = await getDocs(query(collection(db, 'pickups'), where('status', '==', 'pending')));
  return snapshot.docs
    .filter((item) => {
      const data = item.data();
      return typeof data.facilityId === 'string' && typeof data.facilityName === 'string' && typeof data.facilityAddress === 'string';
    })
    .map((item) => mapPickup(item.id, item.data()));
}

export async function getPickupById(pickupId: string): Promise<Pickup | null> {
  if (MOCK_PICKUP_MODE) return getMockPickupById(pickupId);
  const snapshot = await getDoc(doc(db, 'pickups', pickupId));
  return snapshot.exists() ? mapPickup(snapshot.id, snapshot.data()) : null;
}

export async function getMyPickups(riderId: string): Promise<Pickup[]> {
  if (MOCK_PICKUP_MODE) return getMockPickups('demo-rider').assigned;
  const snapshot = await getDocs(query(collection(db, 'pickups'), where('riderId', '==', riderId)));
  return snapshot.docs.map((item) => mapPickup(item.id, item.data()));
}

export async function getPickupHistory(riderId: string): Promise<Pickup[]> {
  if (MOCK_PICKUP_MODE) return getMockPickups('demo-rider').history;
  const snapshot = await getDocs(query(collection(db, 'pickups'), where('riderId', '==', riderId), where('status', '==', 'completed')));
  return snapshot.docs.map((item) => mapPickup(item.id, item.data()));
}

export async function startPickup(pickupId: string, riderId: string): Promise<void> {
  if (MOCK_PICKUP_MODE) {
    updateMockPickup(pickupId, 'start', 'demo-rider');
    return;
  }
  const pickupRef = doc(db, 'pickups', pickupId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(pickupRef);
    if (!snapshot.exists()) throw new Error('Pickup not found.');
    const data = snapshot.data();
    if (data.riderId !== riderId) throw new Error('This pickup is not assigned to you.');
    if (data.status !== 'accepted') throw new Error('This pickup cannot be started.');
    transaction.update(pickupRef, { status: 'in_progress', updatedAt: serverTimestamp() });
  });
}

export async function completePickup(pickupId: string, riderId: string): Promise<void> {
  if (MOCK_PICKUP_MODE) {
    updateMockPickup(pickupId, 'complete', 'demo-rider');
    return;
  }
  const pickupRef = doc(db, 'pickups', pickupId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(pickupRef);
    if (!snapshot.exists()) throw new Error('Pickup not found.');
    const data = snapshot.data();
    if (data.riderId !== riderId) throw new Error('This pickup is not assigned to you.');
    if (data.status !== 'in_progress') throw new Error('This pickup cannot be completed.');
    transaction.update(pickupRef, { status: 'completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
}
