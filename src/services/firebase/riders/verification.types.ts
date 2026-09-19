export type RiderApplicationStatus =
  | 'incomplete'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'needs_correction';

export interface RiderApplication {
  [x: string]: any;
  id: string;

  riderId: string;

  status: RiderApplicationStatus;

  basicInformationCompleted: boolean;
  identityDocumentCompleted: boolean;
  driversLicenseCompleted: boolean;
  faceVerificationCompleted: boolean;
  vehicleInformationCompleted: boolean;

  submittedAt: unknown;
  reviewedAt: unknown;

  rejectionReason: string | null;
  correctionMessage: string | null;

  createdAt: unknown;
  updatedAt: unknown;
}