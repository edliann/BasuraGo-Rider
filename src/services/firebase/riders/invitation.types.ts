export type RiderInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'expired'
  | 'revoked';

export interface RiderInvitation {
  id: string;
  email: string;
  phoneNumber: string;
  status: RiderInvitationStatus;
  invitedBy: string;
  createdAt: unknown;
  expiresAt: unknown;
  acceptedAt: unknown;
  acceptedBy: string | null;
}