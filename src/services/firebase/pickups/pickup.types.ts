export interface Pickup {
  id: string;

  customerId: string;
  addressId: string;
  wasteTypeId: string;

  // Display information stored on the pickup.
  customerName: string;
  pickupAddress: string;
  pickupLocation?: {
    latitude: number;
    longitude: number;
  } | null;
  wasteTypeName: string;

  estimatedWeight: number;
  actualWeight: number | null;
  collectedWeightKg: number | null;
  facilityReceivedWeightKg: number | null;
  collectionCompletedAt: unknown;
  facilityReceipt: {
    facilityId: string;
    staffUid: string;
    actualWeightKg: number;
    receivedAt: unknown;
  } | null;

  scheduledDate: string;
  scheduledTime: string;

  status: string;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  pricingWorkflowVersion?: number;
  pricingStage?: string | null;
  finalPriceResolution?: {
    status: 'pending' | 'ready' | 'failed' | 'declined' | null;
  } | null;

  facilityId?: string;
  facilityName?: string;
  facilityAddress?: string;

  riderId: string | null;
  vehicleId: string | null;

  notes: string;

  completedAt: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  items?: PickupItemSnapshot[];
  priceSnapshot?: PickupPriceSnapshot | null;
}

export function getFacilityReceivedWeight(pickup: Pickup): number | null {
  const receiptWeight = pickup.facilityReceipt?.actualWeightKg;
  if (
    typeof receiptWeight === 'number' &&
    Number.isFinite(receiptWeight) &&
    receiptWeight > 0
  ) {
    return receiptWeight;
  }
  if (
    typeof pickup.facilityReceivedWeightKg === 'number' &&
    Number.isFinite(pickup.facilityReceivedWeightKg) &&
    pickup.facilityReceivedWeightKg > 0
  ) {
    return pickup.facilityReceivedWeightKg;
  }
  if (
    pickup.status === 'completed' &&
    typeof pickup.actualWeight === 'number' &&
    Number.isFinite(pickup.actualWeight) &&
    pickup.actualWeight > 0
  ) {
    return pickup.actualWeight;
  }
  return null;
}

export interface PickupPricingState {
  label: string | null;
  message: string | null;
  canStart: boolean;
}

export function getPickupCancellationLabel(
  pickup: Pick<Pickup, 'cancelledBy' | 'customerId' | 'riderId'>,
): string {
  if (pickup.cancelledBy && pickup.cancelledBy === pickup.riderId) {
    return 'Rider cancelled';
  }
  if (pickup.cancelledBy && pickup.cancelledBy === pickup.customerId) {
    return 'Customer cancelled';
  }
  return 'Pickup cancelled';
}

export function getPickupPricingState(
  pickup: Pick<
    Pickup,
    'status' | 'pricingWorkflowVersion' | 'pricingStage' | 'finalPriceResolution'
  >,
): PickupPricingState {
  const status = pickup.status.toLowerCase();
  if (status === 'cancelled' || status === 'canceled') {
    return {
      label: 'Pickup cancelled',
      message: 'Do not proceed with collection.',
      canStart: false,
    };
  }

  if (status === 'in_progress') {
    return {label: 'In progress', message: null, canStart: true};
  }

  if (status === 'awaiting_facility_receipt') {
    return {
      label: 'Awaiting facility receipt',
      message: 'Collection is complete. The pickup will be fully completed after facility staff records the received weight.',
      canStart: false,
    };
  }

  if (status === 'completed') {
    return {label: 'Completed', message: null, canStart: true};
  }

  if (pickup.pricingWorkflowVersion !== 2) {
    return {label: null, message: null, canStart: true};
  }

  if (
    pickup.pricingStage === 'awaiting_rider_acceptance'
  ) {
    return status === 'pending'
      ? {
          label: 'Awaiting rider acceptance',
          message: 'This pickup has an initial estimate only. Facility transport pricing is resolved after a facility is assigned; do not start collection.',
          canStart: false,
        }
      : {
          label: 'Pricing update pending',
          message: 'This pickup is assigned, but its pricing stage still shows that rider acceptance is pending. Refresh the pickup and do not start collection until pricing is verified.',
          canStart: false,
        };
  }

  if (
    pickup.finalPriceResolution?.status === 'failed' &&
    pickup.pricingStage === 'awaiting_final_price'
  ) {
    return {
      label: 'Route/pricing issue',
      message: 'A trusted road route is not available yet. Do not start collection; the customer can retry final pricing.',
      canStart: false,
    };
  }

  if (pickup.pricingStage === 'awaiting_final_price') {
    return {
      label: 'Waiting for final pricing',
      message: 'Resolving the trusted pickup-to-facility road route. Wait for the customer to review the final price before starting collection.',
      canStart: false,
    };
  }

  if (pickup.pricingStage === 'awaiting_customer_confirmation') {
    return {
      label: 'Awaiting customer confirmation',
      message: 'The final price is ready. Wait for the customer to confirm it before starting collection.',
      canStart: false,
    };
  }

  if (pickup.pricingStage === 'customer_confirmed') {
    if (status !== 'accepted') {
      return {
        label: 'Pricing status unavailable',
        message: 'The pickup status conflicts with its final-price confirmation. Refresh the pickup before proceeding.',
        canStart: false,
      };
    }
    return {
      label: 'Final price confirmed',
      message: 'The customer confirmed the final price. You may start collection when ready.',
      canStart: true,
    };
  }

  if (
    pickup.pricingStage === 'declined' ||
    pickup.pricingStage === 'cancelled'
  ) {
    return {
      label: pickup.pricingStage === 'declined'
        ? 'Customer declined final price'
        : 'Pickup cancelled',
      message: pickup.pricingStage === 'declined'
        ? 'The customer declined the final price. Do not proceed with collection.'
        : 'The pickup was cancelled. Do not proceed with collection.',
      canStart: false,
    };
  }

  return {
    label: 'Pricing status unavailable',
    message: 'Final-price confirmation could not be verified. Refresh the pickup before proceeding.',
    canStart: false,
  };
}

export interface PickupItemSnapshot {
  wasteTypeId: string;
  wasteTypeName: string;
  bagSizeId: string;
  bagSizeLabel: string;
  quantity: number;
  estimatedWeightKg: number;
}

export function mapPickupItemSnapshots(value: unknown): PickupItemSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): PickupItemSnapshot[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const item = entry as Record<string, unknown>;
    if (
      typeof item.wasteTypeId !== 'string' ||
      typeof item.wasteTypeName !== 'string' ||
      typeof item.bagSizeId !== 'string' ||
      typeof item.bagSizeLabel !== 'string' ||
      typeof item.quantity !== 'number' ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      typeof item.estimatedWeightKg !== 'number' ||
      !Number.isFinite(item.estimatedWeightKg) ||
      item.estimatedWeightKg <= 0
    ) return [];
    return [{
      wasteTypeId: item.wasteTypeId,
      wasteTypeName: item.wasteTypeName,
      bagSizeId: item.bagSizeId,
      bagSizeLabel: item.bagSizeLabel,
      quantity: item.quantity,
      estimatedWeightKg: item.estimatedWeightKg,
    }];
  });
}

export interface PickupPriceSnapshot {
  amountCentavos: number;
  currency: string;
  pricingSource?: string;
  pricingVersion: string;
  breakdown: Record<string, unknown>;
}

function isPriceSnapshotPart(
  value: unknown,
): value is Record<string, unknown> & {
  amountCentavos: number;
  currency: string;
  pricingVersion: string;
  breakdown: Record<string, unknown>;
} {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (
    typeof record.amountCentavos !== 'number' ||
    !Number.isSafeInteger(record.amountCentavos) ||
    record.amountCentavos < 0 ||
    typeof record.currency !== 'string' ||
    typeof record.pricingVersion !== 'string' ||
    typeof record.breakdown !== 'object' ||
    record.breakdown === null
  ) {
    return false;
  }

  const breakdown = record.breakdown as Record<string, unknown>;
  return (
    !('totalCentavos' in breakdown) ||
    (
      typeof breakdown.totalCentavos === 'number' &&
      Number.isSafeInteger(breakdown.totalCentavos) &&
      breakdown.totalCentavos === record.amountCentavos
    )
  );
}

export function mapPickupPriceSnapshot(
  value: unknown,
): PickupPriceSnapshot | null {
  if (typeof value !== 'object' || value === null) return null;

  const snapshot = value as Record<string, unknown>;
  const initialEstimate = isPriceSnapshotPart(snapshot.initialEstimate)
    ? snapshot.initialEstimate
    : null;
  const finalPrice = isPriceSnapshotPart(snapshot.final)
    ? snapshot.final
    : null;
  const rootPrice = isPriceSnapshotPart(snapshot) ? snapshot : null;

  if (
    rootPrice &&
    finalPrice &&
    (
      rootPrice.amountCentavos !== finalPrice.amountCentavos ||
      rootPrice.pricingVersion !== finalPrice.pricingVersion
    )
  ) {
    return null;
  }

  const currentPrice = rootPrice ?? finalPrice ?? initialEstimate;

  if (!currentPrice) return null;

  const pricingSource =
    typeof currentPrice.pricingSource === 'string'
      ? currentPrice.pricingSource
      : typeof initialEstimate?.pricingSource === 'string'
        ? initialEstimate.pricingSource
        : undefined;

  return {
    amountCentavos: currentPrice.amountCentavos,
    currency: currentPrice.currency,
    ...(pricingSource ? { pricingSource } : {}),
    pricingVersion: currentPrice.pricingVersion,
    breakdown: currentPrice.breakdown as Record<string, unknown>,
  };
}
