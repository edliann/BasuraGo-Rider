export type RiderVehicleType =
  | 'motorcycle'
  | 'tricycle'
  | 'van'
  | 'truck'
  | 'other';

export interface RiderVehicleInformation {
  vehicleType: RiderVehicleType;
  make: string;
  model: string;
  color: string;
  plateNumber: string;
  registrationNumber: string;
}

export interface VehicleInformationForm
  extends RiderVehicleInformation {}