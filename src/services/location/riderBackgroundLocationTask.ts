import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import {saveRiderLocation} from '../firebase/riders/location.services';
import {auth} from '../firebase/firebase';
import {
  getRiderMapLocationQuality,
  getRiderMapLocationSampleIssue,
  MAX_LIVE_MAP_LOCATION_ACCURACY_METERS,
  MAX_RIDER_LOCATION_AGE_MS,
  MAX_RIDER_LOCATION_FUTURE_SKEW_MS,
} from './locationQuality';

export const RIDER_BACKGROUND_LOCATION_TASK =
  'basurago-rider-background-location';

type LocationTaskData = {
  locations?: Location.LocationObject[];
};

let publishing = false;
let pendingLocation: {
  riderId: string;
  location: Location.LocationObject;
} | null = null;
let latestPublishedLocation: {
  riderId: string;
  location: Location.LocationObject;
} | null = null;
const publishedLocationListeners = new Set<(
  riderId: string,
  location: Location.LocationObject,
) => void>();
const rejectedLocationListeners = new Set<(
  riderId: string,
  quality: ReturnType<typeof getRiderMapLocationQuality>,
) => void>();

function isSameLocationSample(
  firstRiderId: string | null,
  first: Location.LocationObject | null,
  secondRiderId: string,
  second: Location.LocationObject,
): boolean {
  return firstRiderId === secondRiderId && !!first &&
    first.timestamp === second.timestamp &&
    first.coords.latitude === second.coords.latitude &&
    first.coords.longitude === second.coords.longitude &&
    first.coords.accuracy === second.coords.accuracy;
}

export function getLatestPublishedRiderLocation() {
  return latestPublishedLocation;
}

export function subscribeToPublishedRiderLocation(
  listener: (
    riderId: string,
    location: Location.LocationObject,
  ) => void,
): () => void {
  publishedLocationListeners.add(listener);
  return () => publishedLocationListeners.delete(listener);
}

export function subscribeToRejectedRiderLocation(
  listener: (
    riderId: string,
    quality: ReturnType<typeof getRiderMapLocationQuality>,
  ) => void,
): () => void {
  rejectedLocationListeners.add(listener);
  return () => rejectedLocationListeners.delete(listener);
}

if (!TaskManager.isTaskDefined(RIDER_BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask<LocationTaskData>(
    RIDER_BACKGROUND_LOCATION_TASK,
    async ({data, error}) => {
      if (error) {
        console.error('Background rider location task failed:', error);
        return;
      }

      const riderId = auth.currentUser?.uid;
      if (!riderId || !Array.isArray(data?.locations)) return;

      const now = Date.now();
      const location = data.locations
        .filter((candidate) =>
          getRiderMapLocationSampleIssue(candidate, now) === null)
        .sort((first, second) => second.timestamp - first.timestamp)[0];

      if (!location) {
        const newestCandidate = [...data.locations].sort(
          (first, second) => (second?.timestamp ?? 0) - (first?.timestamp ?? 0),
        )[0];
        if (newestCandidate) {
          const quality = getRiderMapLocationQuality(newestCandidate, now);
          for (const listener of rejectedLocationListeners) {
            listener(riderId, quality);
          }
        }
        if (__DEV__) {
          console.warn(
            'Background rider location task skipped stale or invalid GPS data.',
            {
              candidateCount: data.locations.length,
              samples: data.locations.map((candidate, sampleIndex) => {
                const timestamp = candidate?.timestamp;
                const timestampValid = Number.isFinite(timestamp);
                const ageMs = timestampValid ? now - timestamp : null;
                const ageSeconds = ageMs === null ? null :
                  Math.round(ageMs / 100) / 10;
                const coords = candidate?.coords;
                const latitude = coords?.latitude;
                const longitude = coords?.longitude;
                const accuracy = coords?.accuracy;
                const latitudeValid = typeof latitude === 'number' &&
                  Number.isFinite(latitude) &&
                  latitude >= -90 && latitude <= 90;
                const longitudeValid = typeof longitude === 'number' &&
                  Number.isFinite(longitude) &&
                  longitude >= -180 && longitude <= 180;
                const accuracyValid = typeof accuracy === 'number' &&
                  Number.isFinite(accuracy) &&
                  accuracy >= 0;

                return {
                  sampleIndex,
                  ageSeconds,
                  accuracyMeters: typeof accuracy === 'number' &&
                    Number.isFinite(accuracy) ? accuracy : null,
                  timestampValid,
                  tooOld: ageMs !== null &&
                    ageMs > MAX_RIDER_LOCATION_AGE_MS,
                  tooFarInFuture: ageMs !== null &&
                    ageMs < -MAX_RIDER_LOCATION_FUTURE_SKEW_MS,
                  latitudeValid,
                  longitudeValid,
                  accuracyValid,
                  accuracyWithinLimit: accuracyValid &&
                    accuracy <= MAX_LIVE_MAP_LOCATION_ACCURACY_METERS,
                  validationIssue:
                    getRiderMapLocationSampleIssue(candidate, now),
                };
              }),
            },
          );
        }
        return;
      }

      if (isSameLocationSample(
        latestPublishedLocation?.riderId ?? null,
        latestPublishedLocation?.location ?? null,
        riderId,
        location,
      )) {
        return;
      }

      if (publishing) {
        if (
          !pendingLocation ||
          pendingLocation.riderId !== riderId ||
          location.timestamp > pendingLocation.location.timestamp
        ) {
          pendingLocation = {riderId, location};
        }
        return;
      }

      publishing = true;
      try {
        let nextLocation: typeof pendingLocation = {riderId, location};
        while (nextLocation) {
          const next = nextLocation;
          nextLocation = null;
          if (auth.currentUser?.uid === next.riderId) {
            const previous = latestPublishedLocation;
            const alreadyPublished = !!previous &&
              previous.riderId === next.riderId &&
              previous.location.timestamp >= next.location.timestamp;
            if (!alreadyPublished) {
              try {
                await saveRiderLocation(
                  next.riderId,
                  next.location.coords.latitude,
                  next.location.coords.longitude,
                  next.location.coords.accuracy ?? null,
                  next.location.timestamp,
                );
                latestPublishedLocation = next;
                for (const listener of publishedLocationListeners) {
                  listener(next.riderId, next.location);
                }
              } catch (taskError) {
                console.warn(
                  'Background rider location could not be published:',
                  taskError,
                );
                const code =
                  typeof taskError === 'object' &&
                  taskError !== null &&
                  'code' in taskError ?
                    String(taskError.code) : '';
                if (code === 'functions/permission-denied') {
                  pendingLocation = null;
                  try {
                    await stopRiderBackgroundLocation();
                  } catch (stopError) {
                    console.error(
                      'Unable to stop unauthorized background location updates:',
                      stopError,
                    );
                  }
                  break;
                }
              }
            }
          }
          nextLocation = pendingLocation;
          pendingLocation = null;
        }
      } finally {
        publishing = false;
      }
    },
  );
}

let locationTaskOperation: Promise<void> = Promise.resolve();

function serializeLocationTaskOperation(
  operation: () => Promise<void>,
): Promise<void> {
  const nextOperation = locationTaskOperation.then(operation, operation);
  locationTaskOperation = nextOperation.catch(() => undefined);
  return nextOperation;
}

export function startRiderBackgroundLocation(): Promise<void> {
  return serializeLocationTaskOperation(async () => {
    if (
      await Location.hasStartedLocationUpdatesAsync(
        RIDER_BACKGROUND_LOCATION_TASK,
      )
    ) return;

    await Location.startLocationUpdatesAsync(
      RIDER_BACKGROUND_LOCATION_TASK,
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 10,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: 'BasuraGo Rider is online',
          notificationBody:
            'Sharing your location with dispatch while you are online.',
          notificationColor: '#176744',
          killServiceOnDestroy: false,
        },
      },
    );
  });
}

export function stopRiderBackgroundLocation(): Promise<void> {
  return serializeLocationTaskOperation(async () => {
    if (
      await Location.hasStartedLocationUpdatesAsync(
        RIDER_BACKGROUND_LOCATION_TASK,
      )
    ) {
      await Location.stopLocationUpdatesAsync(
        RIDER_BACKGROUND_LOCATION_TASK,
      );
    }
  });
}
