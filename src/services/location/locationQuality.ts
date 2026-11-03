import type * as Location from 'expo-location';

export const MAX_RIDER_LOCATION_AGE_MS = 60_000;
export const MAX_RIDER_LOCATION_FUTURE_SKEW_MS = 30_000;
export const MAX_LIVE_MAP_LOCATION_ACCURACY_METERS = 500;
export const MAX_PICKUP_ACCEPTANCE_LOCATION_ACCURACY_METERS = 300;
export const RIDER_LOCATION_ACQUISITION_TIMEOUT_MS = 60_000;

export type RiderLocationQuality =
  | 'accurate'
  | 'approximate'
  | 'stale'
  | 'unavailable';

export interface RiderLocationQualityState {
  quality: RiderLocationQuality;
  accuracyMeters: number | null;
  message: string;
  issue: string | null;
}

/**
 * Classifies a location for map display without relaxing acceptance checks.
 * @param {Location.LocationObject} location Device location sample.
 * @param {number} now Current time in milliseconds.
 * @return {RiderLocationQualityState} Display quality and validation result.
 */
export function getRiderMapLocationQuality(
  location: Location.LocationObject,
  now = Date.now(),
): RiderLocationQualityState {
  if (
    typeof location !== 'object' ||
    location === null ||
    typeof location.coords !== 'object' ||
    location.coords === null
  ) {
    return {
      quality: 'unavailable',
      accuracyMeters: null,
      message: 'Location is unavailable. Waiting for a device fix.',
      issue: 'GPS did not return a valid position. Wait for a new location fix.',
    };
  }

  const {latitude, longitude, accuracy} = location.coords;
  const age = now - location.timestamp;
  const ageSeconds = Math.max(0, Math.floor(age / 1000));

  if (!Number.isFinite(location.timestamp)) {
    return {
      quality: 'unavailable',
      accuracyMeters: null,
      message: 'Location timestamp is unavailable. Waiting for a device fix.',
      issue: 'GPS timestamp is invalid. Waiting for a fresh device location.',
    };
  }
  if (
    age < -MAX_RIDER_LOCATION_FUTURE_SKEW_MS ||
    age > MAX_RIDER_LOCATION_AGE_MS
  ) {
    return {
      quality: 'stale',
      accuracyMeters: typeof accuracy === 'number' ? accuracy : null,
      message:
        `Location is stale (last fix ${ageSeconds} seconds ago). ` +
        'Waiting for a fresh device fix.',
      issue: 'GPS update is stale. Waiting for a fresh device location.',
    };
  }
  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) {
    return {
      quality: 'unavailable',
      accuracyMeters: null,
      message: 'Location is unavailable. Waiting for a valid device fix.',
      issue: 'GPS returned an invalid position. Waiting for a valid fix.',
    };
  }
  if (
    typeof accuracy !== 'number' ||
    !Number.isFinite(accuracy) ||
    accuracy < 0
  ) {
    return {
      quality: 'unavailable',
      accuracyMeters: null,
      message: 'Location accuracy is unavailable. Waiting for a measured fix.',
      issue: 'GPS accuracy is unavailable. Waiting for a better location fix.',
    };
  }
  if (accuracy > MAX_LIVE_MAP_LOCATION_ACCURACY_METERS) {
    return {
      quality: 'unavailable',
      accuracyMeters: accuracy,
      message:
        `Location is too imprecise to show (${Math.round(accuracy * 10) / 10} m ` +
        `accuracy). Waiting for a fix within ` +
        `${MAX_LIVE_MAP_LOCATION_ACCURACY_METERS} m.`,
      issue:
        `Location accuracy exceeds ${MAX_LIVE_MAP_LOCATION_ACCURACY_METERS} m.`,
    };
  }
  if (accuracy > MAX_PICKUP_ACCEPTANCE_LOCATION_ACCURACY_METERS) {
    return {
      quality: 'approximate',
      accuracyMeters: accuracy,
      message:
        `Approximate live location (about ${Math.round(accuracy * 10) / 10} m ` +
        `accuracy, updated ${ageSeconds} seconds ago). Pickup acceptance ` +
        `requires ${MAX_PICKUP_ACCEPTANCE_LOCATION_ACCURACY_METERS} m or better.`,
      issue: null,
    };
  }

  return {
    quality: 'accurate',
    accuracyMeters: accuracy,
    message:
      `Fresh location (${Math.round(accuracy * 10) / 10} m accuracy, ` +
      `updated ${ageSeconds} seconds ago).`,
    issue: null,
  };
}

/**
 * Validates a fresh sample for map display. Approximate samples are usable.
 * @param {Location.LocationObject} location Device location sample.
 * @param {number} now Current time in milliseconds.
 * @return {string | null} Validation issue, if any.
 */
export function getRiderMapLocationSampleIssue(
  location: Location.LocationObject,
  now = Date.now(),
): string | null {
  return getRiderMapLocationQuality(location, now).issue;
}

/**
 * Validates a fresh, accurate sample for pickup acceptance.
 * @param {Location.LocationObject} location Device location sample.
 * @param {number} now Current time in milliseconds.
 * @return {string | null} Validation issue, if any.
 */
export function getRiderLocationSampleIssue(
  location: Location.LocationObject,
  now = Date.now(),
): string | null {
  const quality = getRiderMapLocationQuality(location, now);
  if (quality.issue) return quality.issue;
  if (quality.quality === 'approximate') {
    return `Location accuracy must be ${MAX_PICKUP_ACCEPTANCE_LOCATION_ACCURACY_METERS} m or better for pickup acceptance.`;
  }
  return quality.quality === 'accurate' ? null :
    'GPS accuracy is unavailable. Waiting for a better location fix.';
}

export interface RiderLocationPublishInput {
  latitude: number;
  longitude: number;
  accuracy: number;
  locationTimestamp: number;
}

/**
 * Creates the high-quality payload used for pickup acceptance.
 * @param {Location.LocationObject} location Device location sample.
 * @param {number} now Current local time for sample freshness validation.
 * @return {RiderLocationPublishInput} Validated location update payload.
 */
export function createRiderLocationPublishInput(
  location: Location.LocationObject,
  now = Date.now(),
): RiderLocationPublishInput {
  const issue = getRiderLocationSampleIssue(location, now);
  if (issue) throw new Error(issue);

  const {latitude, longitude, accuracy} = location.coords;
  if (typeof accuracy !== 'number') {
    throw new Error('GPS accuracy is unavailable. Wait for a better fix.');
  }

  return {
    latitude,
    longitude,
    accuracy,
    locationTimestamp: location.timestamp,
  };
}
