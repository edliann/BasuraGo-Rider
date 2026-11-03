import type {Pickup} from './pickup.types';

export interface FacilityDestinationLookupResponse {
  facilityAddress?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}

export type FacilityDestinationLookup = (
  pickupId: string,
) => Promise<FacilityDestinationLookupResponse>;

export type FacilityDirectionsFailure =
  | 'assigned-facility-missing'
  | 'destination-lookup-failed'
  | 'verified-destination-missing';

export class FacilityDirectionsError extends Error {
  public readonly reason: FacilityDirectionsFailure;

  constructor(reason: FacilityDirectionsFailure) {
    super(reason);
    this.name = 'FacilityDirectionsError';
    this.reason = reason;
  }
}

function getValidAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const address = value.trim().replace(/\s+/g, ' ');
  if (
    !address ||
    address.length > 500 ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(address)
  ) {
    return null;
  }
  return address;
}

function getValidCoordinates(
  latitude: unknown,
  longitude: unknown,
): {latitude: number; longitude: number} | null {
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return {latitude, longitude};
}

export function createGoogleMapsDirectionsUrl(
  destination: FacilityDestinationLookupResponse,
): string | null {
  const coordinates = getValidCoordinates(
    destination.latitude,
    destination.longitude,
  );
  const address = getValidAddress(destination.facilityAddress);
  const destinationValue = coordinates
    ? `${coordinates.latitude},${coordinates.longitude}`
    : address;

  if (!destinationValue) return null;
  return 'https://www.google.com/maps/dir/?api=1' +
    `&destination=${encodeURIComponent(destinationValue)}` +
    '&travelmode=driving';
}

export async function resolveFacilityDirectionsUrl(
  pickup: Pick<Pickup, 'id' | 'facilityId' | 'facilityAddress'>,
  lookup: FacilityDestinationLookup,
): Promise<string> {
  if (
    typeof pickup.facilityId !== 'string' ||
    !pickup.facilityId.trim() ||
    pickup.facilityId.length > 128 ||
    pickup.facilityId.includes('/')
  ) {
    throw new FacilityDirectionsError('assigned-facility-missing');
  }

  const snapshotAddress = getValidAddress(pickup.facilityAddress);
  if (snapshotAddress) {
    const snapshotUrl = createGoogleMapsDirectionsUrl({
      facilityAddress: snapshotAddress,
    });
    if (snapshotUrl) return snapshotUrl;
  }

  let destination: FacilityDestinationLookupResponse;
  try {
    destination = await lookup(pickup.id);
  } catch {
    throw new FacilityDirectionsError('destination-lookup-failed');
  }

  const url = createGoogleMapsDirectionsUrl(destination);
  if (!url) {
    throw new FacilityDirectionsError('verified-destination-missing');
  }
  return url;
}
