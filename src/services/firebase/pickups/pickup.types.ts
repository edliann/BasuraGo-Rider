export interface Pickup {
  id: string;

  customerId: string;
  addressId: string;
  wasteTypeId: string;

  // Display information stored on the pickup.
  customerName: string;
  pickupAddress: string;
  wasteTypeName: string;

  estimatedWeight: number;
  actualWeight: number | null;

  scheduledDate: string;
  scheduledTime: string;

  status: string;

  facilityId?: string;
  facilityName?: string;
  facilityAddress?: string;

  riderId: string | null;
  vehicleId: string | null;

  notes: string;

  completedAt: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}