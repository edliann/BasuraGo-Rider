export const PICKUP_QR_TYPE = 'basurago-pickup';

export interface PickupQrVisibilityInput {
  status: string;
  isAssignedRider: boolean;
  canStart: boolean;
  actualWeight: number | null;
  hasFacilityReceipt: boolean;
}

export function shouldShowPickupQr({
  status,
  isAssignedRider,
  canStart,
  actualWeight,
  hasFacilityReceipt,
}: PickupQrVisibilityInput): boolean {
  if (!isAssignedRider || actualWeight !== null || hasFacilityReceipt) {
    return false;
  }

  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus === 'accepted') return canStart;
  return normalizedStatus === 'in_progress' ||
    normalizedStatus === 'awaiting_facility_receipt';
}

export function createPickupQrPayload(pickupId: string): string {
  return JSON.stringify({
    v: 1,
    type: PICKUP_QR_TYPE,
    pickupId,
  });
}
