import { getFunctions, httpsCallable } from 'firebase/functions';
import firebaseApp from '../firebase';

interface AcceptPickupInput { pickupId: string; }
interface AcceptPickupResult { success: true; pickupId: string; }

const functions = getFunctions(firebaseApp, 'us-central1');
const acceptPickupCallable = httpsCallable<AcceptPickupInput, AcceptPickupResult>(functions, 'acceptPickupFunction');

function getCallableErrorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error) || typeof error.code !== 'string') return '';
  return error.code.replace(/^functions\//, '');
}
function getCallableErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return '';
}
function getCallableErrorReason(error: unknown): string {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('details' in error) ||
    typeof error.details !== 'object' ||
    error.details === null ||
    !('reason' in error.details) ||
    typeof error.details.reason !== 'string'
  ) return '';
  return error.details.reason;
}

/**
 * Reads a non-sensitive location validation code from a callable error.
 * @param {unknown} error Firebase callable error.
 * @return {string} Location validation code, if present.
 */
function getCallableLocationIssue(error: unknown): string {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('details' in error) ||
    typeof error.details !== 'object' ||
    error.details === null ||
    !('locationIssue' in error.details) ||
    typeof error.details.locationIssue !== 'string'
  ) return '';
  return error.details.locationIssue;
}
function toAcceptPickupError(error: unknown): Error {
  const code = getCallableErrorCode(error);
  const reason = getCallableErrorReason(error);
  const locationIssue = getCallableLocationIssue(error);
  const message = getCallableErrorMessage(error);
  if (code === 'unauthenticated') return new Error('Please sign in again to accept a pickup.');
  if (code === 'permission-denied') return new Error('Your rider account is not authorized to accept pickups.');
  if (reason === 'PRICING_ACCEPTANCE_LOCATION_INVALID') {
    if (locationIssue === 'accuracy-exceeds-limit') {
      return new Error(
        'The latest location saved by the server is outside the 300 m ' +
          'accuracy limit. Wait for a new location update and try again.',
      );
    }
    if (locationIssue === 'timestamp-stale') {
      return new Error(
        'The latest location saved by the server is stale. Wait for a new ' +
          'location update and try again.',
      );
    }
    if (locationIssue === 'timestamp-in-future') {
      return new Error(
        'The latest location timestamp could not be verified. Wait for a ' +
          'new location update and try again.',
      );
    }
    return new Error(
      'The server could not verify a valid, fresh location within the ' +
        '300 m acceptance limit. Wait for a new location update and retry.',
    );
  }
  if (code === 'failed-precondition' && message.includes('no longer available')) return new Error('This pickup is no longer available. Refresh the list and try another pickup.');
  if (code === 'failed-precondition') return new Error('Your rider account or vehicle is not eligible to accept pickups.');
  if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) return new Error('Network connection failed. Check your connection and try again.');
  return new Error('Unable to accept this pickup. Please try again.');
}

export async function acceptPickup(pickupId: string): Promise<void> {
  const normalizedPickupId = pickupId.trim();
  if (!normalizedPickupId) throw new Error('Pickup ID is required.');

  let result: Awaited<ReturnType<typeof acceptPickupCallable>>;
  try {
    result = await acceptPickupCallable({ pickupId: normalizedPickupId });
  } catch (error) {
    throw toAcceptPickupError(error);
  }
  if (result.data.success !== true || result.data.pickupId !== normalizedPickupId) {
    throw new Error('The server did not confirm this pickup acceptance.');
  }
}
