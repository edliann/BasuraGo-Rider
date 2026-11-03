import { getAuth } from 'firebase/auth';
import {
  collection, doc, getCountFromServer, getDocs, getDoc, getDocFromServer,
  getFirestore, limit, orderBy, query, startAfter, where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import firebaseApp from '../firebase';
import {
  mapPickupItemSnapshots,
  mapPickupPriceSnapshot,
  type Pickup,
} from './pickup.types';

const db = getFirestore(firebaseApp);
const functions = getFunctions(firebaseApp, 'us-central1');
const AVAILABLE_PICKUP_PAGE_SIZE = 50;
const MY_PICKUP_PAGE_SIZE = 5;
const PICKUP_HISTORY_PAGE_SIZE = 5;
const ACTIVE_PICKUP_STATUSES = [
  'in_progress',
  'accepted',
  'pending',
  'awaiting_facility_receipt',
] as const;
const HISTORY_PICKUP_STATUSES = ['completed', 'cancelled', 'canceled'] as const;
const MY_PICKUP_PRIORITY_GROUPS: readonly (readonly string[])[] = [
  ['in_progress'],
  ['accepted'],
  ['pending'],
  ['awaiting_facility_receipt'],
];
const MY_PICKUP_STATUS_GROUPS = {
  accepted: ['accepted'],
  in_progress: ['in_progress'],
  pending: ['pending'],
  awaiting_facility_receipt: ['awaiting_facility_receipt'],
} as const;
const listAvailablePickupsCallable = httpsCallable<
  {cursor?: string; pageSize: number},
  {pickups: Pickup[]; nextCursor: string | null}
>(
  functions,
  'listAvailablePickupsFunction',
);
export type PickupTrashPhotoUrl = {
  path: string;
  signedUrl: string;
  thumbnailUrl?: string;
};
const PICKUP_PHOTO_URL_CACHE_MS = 4 * 60 * 1000;
const pickupPhotoUrlCache = new Map<
  string,
  {photos: PickupTrashPhotoUrl[]; expiresAt: number}
>();
const pickupPhotoUrlRequests = new Map<
  string,
  Promise<PickupTrashPhotoUrl[]>
>();
const getPickupTrashPhotoUrlsCallable = httpsCallable<
  {pickupId: string},
  {photos: PickupTrashPhotoUrl[]}
>(functions, 'getPickupTrashPhotoUrlsFunction');
const getPickupCustomerContactCallable = httpsCallable<
  {pickupId: string},
  {customerFound: boolean; phoneNumber: string | null}
>(functions, 'getPickupCustomerContactFunction');
const getPickupDestinationCallable = httpsCallable<
  {pickupId: string},
  {
    facilityName: string;
    facilityAddress: string;
    latitude: number | null;
    longitude: number | null;
  }
>(functions, 'getPickupDestinationFunction');
const startPickupCallable = httpsCallable<
  {pickupId: string},
  {success: true; pickupId: string}
>(functions, 'startPickupFunction');
const completePickupCallable = httpsCallable<
  {pickupId: string},
  {
    success: true;
    pickupId: string;
    status: 'awaiting_facility_receipt' | 'completed';
    alreadyCompleted: boolean;
  }
>(functions, 'completePickupFunction');
const cancelAcceptedPickupByRiderCallable = httpsCallable<
  {pickupId: string; reason: string},
  {success: true; pickupId: string; status: 'cancelled'}
>(functions, 'cancelAcceptedPickupByRiderFunction');

export type CustomerPhoneLookupFailure =
  | 'service-unavailable'
  | 'permission-denied'
  | 'network'
  | 'pickup-not-found'
  | 'backend';

export class CustomerPhoneLookupError extends Error {
  constructor(
    public readonly failure: CustomerPhoneLookupFailure,
    public readonly firebaseCode: string,
  ) {
    super('Unable to retrieve customer contact information.');
    this.name = 'CustomerPhoneLookupError';
  }
}

export async function getPickupCustomerPhone(
  pickupId: string,
): Promise<{customerFound: boolean; phoneNumber: string | null}> {
  try {
    const result = await getPickupCustomerContactCallable({pickupId});
    return result.data;
  } catch (error) {
    const firebaseCode =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : 'unknown';
    const errorMessage =
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
        ? error.message
        : '';
    const failure: CustomerPhoneLookupFailure =
      firebaseCode === 'functions/not-found' &&
          errorMessage === 'Pickup not found.'
        ? 'pickup-not-found'
        : firebaseCode === 'functions/not-found'
          ? 'service-unavailable'
        : firebaseCode === 'functions/permission-denied' ||
            firebaseCode === 'functions/unauthenticated'
          ? 'permission-denied'
          : firebaseCode === 'functions/unavailable' ||
              firebaseCode === 'functions/deadline-exceeded' ||
              firebaseCode === 'functions/cancelled'
            ? 'network'
            : 'backend';
    throw new CustomerPhoneLookupError(failure, firebaseCode);
  }
}

export async function getPickupDestination(pickupId: string): Promise<{
  facilityName: string;
  facilityAddress: string;
  latitude: number | null;
  longitude: number | null;
}> {
  const result = await getPickupDestinationCallable({pickupId});
  return result.data;
}

function mapPickupLocation(value: unknown): Pickup['pickupLocation'] {
  const location = value as { latitude?: unknown; longitude?: unknown } | null;
  if (!location || typeof location !== 'object') return null;
  const { latitude, longitude } = location;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

function getAddressText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object' || value === null) return '';
  const address = (value as {address?: unknown}).address;
  return typeof address === 'string' ? address.trim() : '';
}

function mapPickupAddress(data: Record<string, any>): string {
  const priceSnapshot = data.priceSnapshot as Record<string, any> | null;
  const initialEstimate =
    priceSnapshot?.initialEstimate as Record<string, any> | undefined;
  const candidates = [
    data.pickupAddress,
    data.address,
    initialEstimate?.inputSnapshot?.address,
    priceSnapshot?.inputSnapshot?.address,
  ];
  return candidates.map(getAddressText).find(Boolean) ?? '';
}

function mapPickup(id: string, data: Record<string, any>): Pickup {
  return {
    id,
    customerId: data.customerId ?? '',
    addressId: data.addressId ?? '',
    wasteTypeId: data.wasteTypeId ?? '',
    items: mapPickupItemSnapshots(data.items),
    priceSnapshot: mapPickupPriceSnapshot(data.priceSnapshot),
    customerName: data.customerName ?? '',
    pickupAddress: mapPickupAddress(data),
    pickupLocation: mapPickupLocation(data.pickupLocation),
    wasteTypeName: data.wasteTypeName ?? '',
    estimatedWeight: data.estimatedWeight ?? 0,
    actualWeight: data.actualWeight ?? null,
    collectedWeightKg:
      typeof data.collectedWeightKg === 'number' &&
      Number.isFinite(data.collectedWeightKg) &&
      data.collectedWeightKg > 0
        ? data.collectedWeightKg
        : null,
    facilityReceivedWeightKg:
      typeof data.facilityReceivedWeightKg === 'number' &&
      Number.isFinite(data.facilityReceivedWeightKg) &&
      data.facilityReceivedWeightKg > 0
        ? data.facilityReceivedWeightKg
        : null,
    collectionCompletedAt: data.collectionCompletedAt ?? null,
    facilityReceipt:
      typeof data.facilityReceipt === 'object' &&
      data.facilityReceipt !== null &&
      typeof data.facilityReceipt.facilityId === 'string' &&
      typeof data.facilityReceipt.staffUid === 'string' &&
      typeof data.facilityReceipt.actualWeightKg === 'number' &&
      Number.isFinite(data.facilityReceipt.actualWeightKg) &&
      data.facilityReceipt.actualWeightKg > 0
        ? {
            facilityId: data.facilityReceipt.facilityId,
            staffUid: data.facilityReceipt.staffUid,
            actualWeightKg: data.facilityReceipt.actualWeightKg,
            receivedAt: data.facilityReceipt.receivedAt ?? null,
          }
        : null,
    scheduledDate: data.scheduledDate ?? '',
    scheduledTime: data.scheduledTime ?? '',
    status: data.status ?? 'pending',
    cancelledBy: typeof data.cancelledBy === 'string' ? data.cancelledBy : null,
    cancellationReason:
      typeof data.cancellationReason === 'string'
        ? data.cancellationReason
        : null,
    pricingWorkflowVersion: data.pricingWorkflowVersion === 2 ? 2 : undefined,
    pricingStage: typeof data.pricingStage === 'string'
      ? data.pricingStage
      : null,
    finalPriceResolution:
      typeof data.finalPriceResolution === 'object' &&
      data.finalPriceResolution !== null &&
      ['pending', 'ready', 'failed', 'declined'].includes(
        data.finalPriceResolution.status,
      )
        ? {status: data.finalPriceResolution.status}
        : null,
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

export type AvailablePickupsPage = {
  pickups: Pickup[];
  nextCursor: string | null;
};

export async function getAvailablePickupsPage(
  cursor?: string,
): Promise<AvailablePickupsPage> {
  const result = await listAvailablePickupsCallable({
    pageSize: AVAILABLE_PICKUP_PAGE_SIZE,
    ...(cursor ? {cursor} : {}),
  });
  return {
    pickups: result.data.pickups.map((pickup) => ({
      ...pickup,
      pickupLocation: mapPickupLocation(pickup.pickupLocation),
    })),
    nextCursor: result.data.nextCursor,
  };
}

export async function getPickupTrashPhotoUrls(
  pickupId: string,
): Promise<PickupTrashPhotoUrl[]> {
  const riderUid = getAuth(firebaseApp).currentUser?.uid ?? null;
  const cacheKey = `${riderUid ?? 'signed-out'}:${pickupId}`;
  for (const [cachedPickupId, entry] of pickupPhotoUrlCache) {
    if (entry.expiresAt <= Date.now()) pickupPhotoUrlCache.delete(cachedPickupId);
  }
  const cached = riderUid ? pickupPhotoUrlCache.get(cacheKey) : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    pickupPhotoUrlCache.delete(cacheKey);
    pickupPhotoUrlCache.set(cacheKey, cached);
    return cached.photos;
  }

  const pending = pickupPhotoUrlRequests.get(cacheKey);
  if (pending) return pending;

  const request = getPickupTrashPhotoUrlsCallable({pickupId}).then(
    (result) => {
      const photos = result.data.photos;
      if (riderUid) {
        pickupPhotoUrlCache.set(cacheKey, {
          photos,
          expiresAt: Date.now() + PICKUP_PHOTO_URL_CACHE_MS,
        });
        if (pickupPhotoUrlCache.size > 20) {
          const oldestCacheKey = pickupPhotoUrlCache.keys().next().value;
          if (oldestCacheKey) pickupPhotoUrlCache.delete(oldestCacheKey);
        }
      }
      return photos;
    },
  );
  pickupPhotoUrlRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (pickupPhotoUrlRequests.get(cacheKey) === request) {
      pickupPhotoUrlRequests.delete(cacheKey);
    }
  }
}

export async function getAvailablePickups(): Promise<Pickup[]> {
  const pickups: Pickup[] = [];
  let cursor: string | undefined;

  do {
    const page = await getAvailablePickupsPage(cursor);
    pickups.push(...page.pickups);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  return pickups;
}

export async function getPickupById(pickupId: string): Promise<Pickup | null> {
  const snapshot = await getDoc(doc(db, 'pickups', pickupId));
  return snapshot.exists() ? mapPickup(snapshot.id, snapshot.data()) : null;
}

export async function getPickupByIdFromServer(
  pickupId: string,
): Promise<Pickup | null> {
  const snapshot = await getDocFromServer(doc(db, 'pickups', pickupId));
  return snapshot.exists() ? mapPickup(snapshot.id, snapshot.data()) : null;
}

export async function getMyPickups(riderId: string): Promise<Pickup[]> {
  const snapshot = await getDocs(query(collection(db, 'pickups'), where('riderId', '==', riderId)));
  return snapshot.docs.map((item) => mapPickup(item.id, item.data()));
}

export async function getMyActivePickupCount(riderId: string): Promise<number> {
  const snapshot = await getCountFromServer(query(
    collection(db, 'pickups'),
    where('riderId', '==', riderId),
    where('status', 'in', [...ACTIVE_PICKUP_STATUSES]),
  ));
  return snapshot.data().count;
}

export async function getCompletedPickupCount(riderId: string): Promise<number> {
  const snapshot = await getCountFromServer(query(
    collection(db, 'pickups'),
    where('riderId', '==', riderId),
    where('status', '==', 'completed'),
  ));
  return snapshot.data().count;
}

export type MyPickupStatusFilter =
  | 'all'
  | keyof typeof MY_PICKUP_STATUS_GROUPS;

export interface MyPickupsPageCursor {
  groupIndex: number;
  lastDocument: QueryDocumentSnapshot | null;
}

export interface MyPickupsPage {
  pickups: Pickup[];
  nextCursor: MyPickupsPageCursor | null;
}

export async function getMyPickupsPage(
  riderId: string,
  statusFilter: MyPickupStatusFilter,
  cursor: MyPickupsPageCursor | null = null,
): Promise<MyPickupsPage> {
  const statusGroups = statusFilter === 'all'
    ? MY_PICKUP_PRIORITY_GROUPS
    : [MY_PICKUP_STATUS_GROUPS[statusFilter]];
  const pickups: Pickup[] = [];
  let groupIndex = cursor?.groupIndex ?? 0;
  let lastDocument = cursor?.lastDocument ?? null;

  while (groupIndex < statusGroups.length) {
    const remaining = MY_PICKUP_PAGE_SIZE - pickups.length;
    const statuses = statusGroups[groupIndex];
    const statusConstraint = statuses.length === 1
      ? where('status', '==', statuses[0])
      : where('status', 'in', [...statuses]);
    const pickupQuery = lastDocument
      ? query(
          collection(db, 'pickups'),
          where('riderId', '==', riderId),
          statusConstraint,
          orderBy('updatedAt', 'desc'),
          startAfter(lastDocument),
          limit(remaining + 1),
        )
      : query(
          collection(db, 'pickups'),
          where('riderId', '==', riderId),
          statusConstraint,
          orderBy('updatedAt', 'desc'),
          limit(remaining + 1),
        );
    const snapshot = await getDocs(pickupQuery);
    const pageDocuments = snapshot.docs.slice(0, remaining);
    pickups.push(
      ...pageDocuments.map((item) => mapPickup(item.id, item.data())),
    );

    if (snapshot.docs.length > remaining) {
      return {
        pickups,
        nextCursor: {
          groupIndex,
          lastDocument: remaining === 0
            ? lastDocument
            : pageDocuments[pageDocuments.length - 1],
        },
      };
    }

    groupIndex += 1;
    lastDocument = null;
  }

  return {pickups, nextCursor: null};
}

export async function getPickupHistory(riderId: string): Promise<Pickup[]> {
  const snapshot = await getDocs(query(
    collection(db, 'pickups'),
    where('riderId', '==', riderId),
    where('status', 'in', [...HISTORY_PICKUP_STATUSES]),
  ));
  return snapshot.docs.map((item) => mapPickup(item.id, item.data()));
}

export type PickupHistoryStatusFilter = 'all' | 'completed' | 'cancelled';

export interface PickupHistoryPage {
  pickups: Pickup[];
  nextCursor: QueryDocumentSnapshot | null;
}

export async function getPickupHistoryPage(
  riderId: string,
  statusFilter: PickupHistoryStatusFilter,
  cursor: QueryDocumentSnapshot | null = null,
): Promise<PickupHistoryPage> {
  const statuses = statusFilter === 'all'
    ? [...HISTORY_PICKUP_STATUSES]
    : statusFilter === 'completed'
      ? ['completed']
      : ['cancelled', 'canceled'];
  const statusConstraint = where('status', 'in', statuses);
  const pickupQuery = cursor
    ? query(
        collection(db, 'pickups'),
        where('riderId', '==', riderId),
        statusConstraint,
        orderBy('updatedAt', 'desc'),
        startAfter(cursor),
        limit(PICKUP_HISTORY_PAGE_SIZE + 1),
      )
    : query(
        collection(db, 'pickups'),
        where('riderId', '==', riderId),
        statusConstraint,
        orderBy('updatedAt', 'desc'),
        limit(PICKUP_HISTORY_PAGE_SIZE + 1),
      );
  const snapshot = await getDocs(pickupQuery);
  const pageDocuments = snapshot.docs.slice(0, PICKUP_HISTORY_PAGE_SIZE);
  const hasMore = snapshot.docs.length > PICKUP_HISTORY_PAGE_SIZE;

  return {
    pickups: pageDocuments.map((item) => mapPickup(item.id, item.data())),
    nextCursor: hasMore ? pageDocuments[pageDocuments.length - 1] : null,
  };
}

export async function getPickupHistoryCount(
  riderId: string,
  statusFilter: PickupHistoryStatusFilter,
): Promise<number> {
  const statuses = statusFilter === 'all'
    ? [...HISTORY_PICKUP_STATUSES]
    : statusFilter === 'completed'
      ? ['completed']
      : ['cancelled', 'canceled'];
  const snapshot = await getCountFromServer(query(
    collection(db, 'pickups'),
    where('riderId', '==', riderId),
    where('status', 'in', statuses),
  ));
  return snapshot.data().count;
}

export async function startPickup(pickupId: string): Promise<void> {
  const normalizedPickupId = pickupId.trim();
  if (!normalizedPickupId) throw new Error('Pickup ID is required.');

  let result: Awaited<ReturnType<typeof startPickupCallable>>;
  try {
    result = await startPickupCallable({pickupId: normalizedPickupId});
  } catch (error) {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code.replace(/^functions\//, '')
        : '';
    const reason =
      typeof error === 'object' &&
      error !== null &&
      'details' in error &&
      typeof error.details === 'object' &&
      error.details !== null &&
      'reason' in error.details &&
      typeof error.details.reason === 'string'
        ? error.details.reason
        : '';

    if (code === 'unauthenticated') {
      throw new Error('Please sign in again before starting this pickup.');
    }
    if (code === 'permission-denied') {
      throw new Error('Only the rider assigned to this pickup can start collection.');
    }
    if (reason === 'PICKUP_FINAL_PRICE_CONFIRMATION_REQUIRED') {
      throw new Error('The customer must confirm the final price before collection can start.');
    }
    if (code === 'failed-precondition') {
      throw new Error('The pickup state changed. Refresh its details before trying again.');
    }
    if (
      ['unavailable', 'deadline-exceeded', 'network-request-failed', 'cancelled']
        .includes(code)
    ) {
      throw new Error('The pickup could not be started because the service is unavailable. Check your connection and retry.');
    }
    throw new Error('Unable to start this pickup. Please refresh and try again.');
  }

  if (result.data.success !== true || result.data.pickupId !== normalizedPickupId) {
    throw new Error('The server did not confirm that collection started.');
  }
}

export async function cancelAcceptedPickupByRider(
  pickupId: string,
  reason: string,
): Promise<void> {
  const normalizedPickupId = pickupId.trim();
  const normalizedReason = reason.trim();
  if (!normalizedPickupId) throw new Error('Pickup ID is required.');
  if (!normalizedReason || normalizedReason.length > 500) {
    throw new Error('Enter a cancellation reason of at most 500 characters.');
  }

  let result: Awaited<ReturnType<typeof cancelAcceptedPickupByRiderCallable>>;
  try {
    result = await cancelAcceptedPickupByRiderCallable({
      pickupId: normalizedPickupId,
      reason: normalizedReason,
    });
  } catch (error) {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code.replace(/^functions\//, '')
        : '';

    if (code === 'unauthenticated') {
      throw new Error('Please sign in again before cancelling this pickup.');
    }
    if (code === 'permission-denied') {
      throw new Error(
        'Only the Rider currently assigned to this pickup can cancel it. ' +
          'Your assignment or account authorization may have changed.',
      );
    }
    if (code === 'failed-precondition') {
      throw new Error(
        'The pickup can no longer be cancelled, or its reservation data needs ' +
          'review. Pickup details have been refreshed.',
      );
    }
    if (code === 'invalid-argument') {
      throw new Error('Enter a valid cancellation reason and refresh the pickup.');
    }
    if (
      ['unavailable', 'deadline-exceeded', 'network-request-failed', 'cancelled']
        .includes(code)
    ) {
      throw new Error(
        'The cancellation could not be confirmed because the service is ' +
          'unavailable. Pickup details have been refreshed; check its current ' +
          'status before trying again.',
      );
    }
    throw new Error('Unable to cancel this pickup. Refresh and try again.');
  }

  if (
    result.data.success !== true ||
    result.data.pickupId !== normalizedPickupId ||
    result.data.status !== 'cancelled'
  ) {
    throw new Error('The server did not confirm pickup cancellation.');
  }
}

export async function completePickup(
  pickupId: string,
): Promise<{
  status: 'awaiting_facility_receipt' | 'completed';
  alreadyCompleted: boolean;
}> {
  const normalizedPickupId = pickupId.trim();
  if (!normalizedPickupId) throw new Error('Pickup ID is required.');

  let result: Awaited<ReturnType<typeof completePickupCallable>>;
  try {
    result = await completePickupCallable({pickupId: normalizedPickupId});
  } catch (error) {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code.replace(/^functions\//, '')
        : '';
    const reason =
      typeof error === 'object' &&
      error !== null &&
      'details' in error &&
      typeof error.details === 'object' &&
      error.details !== null &&
      'reason' in error.details &&
      typeof error.details.reason === 'string'
        ? error.details.reason
        : '';

    if (code === 'unauthenticated') {
      throw new Error('Please sign in again before completing this collection.');
    }
    if (code === 'permission-denied') {
      throw new Error('Only the rider assigned to this pickup can complete collection.');
    }
    if (reason === 'PICKUP_FINAL_PRICE_CONFIRMATION_REQUIRED') {
      throw new Error('The customer must confirm the final price before collection can be completed.');
    }
    if (code === 'failed-precondition') {
      throw new Error('The pickup state or rider eligibility changed. Refresh its details before retrying.');
    }
    if (code === 'not-found') {
      throw new Error(
        'The Backend could not complete this pickup. Refresh your assigned pickups; if the issue continues, contact support.',
      );
    }
    if (code === 'invalid-argument') {
      throw new Error('The pickup reference is invalid. Refresh the pickup and try again.');
    }
    if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) {
      throw new Error('The outcome may be uncertain because the service is unavailable. Refresh the pickup; retrying is safe and will not overwrite an existing completion.');
    }
    throw new Error('Unable to complete collection. Refresh the pickup and try again.');
  }

  if (
    result.data.success !== true ||
    result.data.pickupId !== normalizedPickupId ||
    !['awaiting_facility_receipt', 'completed'].includes(result.data.status) ||
    typeof result.data.alreadyCompleted !== 'boolean'
  ) {
    throw new Error('The server did not confirm collection completion.');
  }

  return {
    status: result.data.status,
    alreadyCompleted: result.data.alreadyCompleted,
  };
}
