import {
  getFunctions,
  httpsCallable,
} from 'firebase/functions';

import app from '../firebase';

interface AcceptPickupInput {
  pickupId: string;
}

interface AcceptPickupResult {
  success: true;
  pickupId: string;
}

const functions = getFunctions(app, 'us-central1');

const acceptPickupCallable = httpsCallable<
  AcceptPickupInput,
  AcceptPickupResult
>(functions, 'acceptPickupFunction');

function getCallableErrorCode(error: unknown): string {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    typeof error.code !== 'string'
  ) {
    return '';
  }

  return error.code.replace(/^functions\//, '');
}

function getCallableErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return '';
}

function toAcceptPickupError(error: unknown): Error {
  const code = getCallableErrorCode(error);
  const message = getCallableErrorMessage(error);

  if (code === 'unauthenticated') {
    return new Error('Please sign in again to accept a pickup.');
  }

  if (code === 'permission-denied') {
    return new Error(
      'Your rider account is not authorized to accept pickups.',
    );
  }

  if (
    code === 'failed-precondition' &&
    message.includes('no longer available')
  ) {
    return new Error(
      'This pickup is no longer available. Refresh the list and try another pickup.',
    );
  }

  if (code === 'failed-precondition') {
    return new Error(
      'Your rider account or vehicle is not eligible to accept pickups.',
    );
  }

  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'network-request-failed'
  ) {
    return new Error('Network connection failed. Check your connection and try again.');
  }

  return new Error('Unable to accept this pickup. Please try again.');
}

export async function acceptPickup(pickupId: string): Promise<void> {
  const normalizedPickupId = pickupId.trim();

  if (!normalizedPickupId) {
    throw new Error('Pickup ID is required.');
  }

  let result: Awaited<
    ReturnType<typeof acceptPickupCallable>
  >;

  try {
    result = await acceptPickupCallable({
      pickupId: normalizedPickupId,
    });
  } catch (error) {
    throw toAcceptPickupError(error);
  }

  if (
    result.data.success !== true ||
    result.data.pickupId !== normalizedPickupId
  ) {
    throw new Error('The server did not confirm this pickup acceptance.');
  }
}
