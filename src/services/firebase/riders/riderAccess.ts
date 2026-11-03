export type RiderAccessDecision =
  | 'authorized'
  | 'verification'
  | 'denied';

const VERIFICATION_STATUSES = new Set([
  'incomplete',
  'submitted',
  'under_review',
  'needs_correction',
  'rejected',
]);

export function getRiderAccessDecision(
  riderStatus: unknown,
  applicationStatus: unknown,
): RiderAccessDecision {
  if (riderStatus === 'inactive' || riderStatus === 'suspended') {
    return 'denied';
  }

  if (
    riderStatus === 'active' &&
    (applicationStatus === null || applicationStatus === undefined)
  ) {
    return 'authorized';
  }

  if (
    riderStatus === 'active' &&
    applicationStatus === 'approved'
  ) {
    return 'authorized';
  }

  if (
    typeof applicationStatus === 'string' &&
    VERIFICATION_STATUSES.has(applicationStatus)
  ) {
    return 'verification';
  }

  return 'denied';
}
