export interface Rider {
  id: string;
  fullName: string;
  phoneNumber: string;
  status: string;
  vehicleId: string | null;
  isOnline: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}