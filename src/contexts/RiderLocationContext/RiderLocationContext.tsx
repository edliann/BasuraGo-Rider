import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Alert,
  AppState,
  Linking,
  Platform,
  type AppStateStatus,
} from 'react-native';
import * as Location from 'expo-location';
import {
  doc,
  getFirestore,
  onSnapshot,
} from 'firebase/firestore';
import {useAuth} from '../AuthContext/AuthContext';
import {auth} from '../../services/firebase/auth/auth.services';
import firebaseApp from '../../services/firebase/firebase';
import {updateRiderOnlineStatus} from
  '../../services/firebase/riders/riders.services';
import {saveRiderLocation} from
  '../../services/firebase/riders/location.services';
import {
  startRiderBackgroundLocation,
  stopRiderBackgroundLocation,
  getLatestPublishedRiderLocation,
  subscribeToPublishedRiderLocation,
  subscribeToRejectedRiderLocation,
} from '../../services/location/riderBackgroundLocationTask';
import {
  getRiderMapLocationQuality,
  getRiderLocationSampleIssue,
  MAX_RIDER_LOCATION_AGE_MS,
  RIDER_LOCATION_ACQUISITION_TIMEOUT_MS,
  type RiderLocationQuality,
} from '../../services/location/locationQuality';

interface RiderLocationContextValue {
  isOnline: boolean;
  availabilityLoaded: boolean;
  locationTracking: boolean;
  latestLocation: Location.LocationObject | null;
  locationQuality: RiderLocationQuality;
  locationServicesEnabled: boolean | null;
  locationMessage: string;
  waitForFreshLocation: (timeoutMs?: number) => Promise<Location.LocationObject>;
  checkLocationServices: () => Promise<boolean>;
  setLocationMessage: (message: string) => void;
}

const RiderLocationContext =
  createContext<RiderLocationContextValue | null>(null);

type LocationWaiter = {
  resolve: (location: Location.LocationObject) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const db = getFirestore(firebaseApp);
const LOCATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 15000,
  distanceInterval: 25,
};
export function RiderLocationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {user, rider} = useAuth();
  const [availability, setAvailability] = useState<{
    riderId: string;
    loaded: boolean;
    eligible: boolean;
    online: boolean;
  } | null>(null);
  const [locationTracking, setLocationTracking] = useState(false);
  const [locationQuality, setLocationQuality] =
    useState<RiderLocationQuality>('unavailable');
  const [publishedLocation, setPublishedLocation] = useState<{
    riderId: string;
    location: Location.LocationObject;
  } | null>(null);
  const publishedLocationRef = useRef<{
    riderId: string;
    location: Location.LocationObject;
  } | null>(null);
  const foregroundWatcherActive = useRef(false);
  const foregroundWatcherStarting = useRef(false);
  const locationWaiters = useRef(new Set<LocationWaiter>());
  const lastRejectedIssue = useRef<string | null>(null);
  const lastRejectedLogAt = useRef(0);
  const [locationServicesEnabled, setLocationServicesEnabled] =
    useState<boolean | null>(null);
  const locationServicesEnabledRef = useRef<boolean | null>(null);
  const updateLocationServicesEnabled = useCallback((enabled: boolean | null) => {
    locationServicesEnabledRef.current = enabled;
    setLocationServicesEnabled(enabled);
  }, []);
  const [locationMessage, setLocationMessage] = useState(
    'Location sharing is off. Go online to share your live location.',
  );
  const alertVisible = useRef(false);
  const foregroundCycle = useRef(0);
  const warnedCycle = useRef(-1);
  const availabilityMatchesRider =
    !!rider && availability?.riderId === rider.id;
  const availabilityLoaded =
    availabilityMatchesRider && availability.loaded;
  const riderEligible =
    availabilityMatchesRider && availability.eligible;
  const isOnline =
    availabilityMatchesRider && availability.online;

  useEffect(() => {
    let active = true;
    if (
      !user ||
      !rider ||
      typeof user.uid !== 'string' ||
      !user.uid ||
      typeof rider.id !== 'string' ||
      !rider.id ||
      user.uid !== rider.id
    ) {
      publishedLocationRef.current = null;
      setPublishedLocation(null);
      setLocationQuality('unavailable');
      setLocationMessage(
        'Location sharing is off. Sign in and go online to share your live location.',
      );
      lastRejectedIssue.current = null;
      for (const waiter of locationWaiters.current) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error('Rider signed out before location was available.'));
      }
      locationWaiters.current.clear();
      return () => {
        active = false;
      };
    }

    const updatePublishedLocation = (
      riderId: string,
      location: Location.LocationObject,
    ) => {
      if (
        !active ||
        !user ||
        !rider ||
        typeof user.uid !== 'string' ||
        !user.uid ||
        typeof rider.id !== 'string' ||
        !rider.id ||
        typeof riderId !== 'string' ||
        !riderId ||
        user.uid !== rider.id ||
        riderId !== rider.id
      ) return;
      const quality = getRiderMapLocationQuality(location);
      if (quality.issue) {
        publishedLocationRef.current = null;
        setPublishedLocation(null);
        setLocationQuality(quality.quality);
        setLocationMessage(quality.message);
        lastRejectedIssue.current = quality.issue;
        return;
      }
      const published = {riderId, location};
      publishedLocationRef.current = published;
      setPublishedLocation(published);
      setLocationQuality(quality.quality);
      setLocationMessage(quality.message);
      const acceptanceIssue = getRiderLocationSampleIssue(location);
      lastRejectedIssue.current = acceptanceIssue;
      if (acceptanceIssue === null) {
        for (const waiter of locationWaiters.current) {
          clearTimeout(waiter.timeout);
          waiter.resolve(location);
        }
        locationWaiters.current.clear();
      }
    };

    const latest = getLatestPublishedRiderLocation();
    if (latest) updatePublishedLocation(latest.riderId, latest.location);
    const unsubscribePublished =
      subscribeToPublishedRiderLocation(updatePublishedLocation);
    const unsubscribeRejectedLocation =
      subscribeToRejectedRiderLocation((riderId, quality) => {
        if (
          !active ||
          !user ||
          !rider ||
          typeof user.uid !== 'string' ||
          !user.uid ||
          typeof rider.id !== 'string' ||
          !rider.id ||
          typeof riderId !== 'string' ||
          !riderId ||
          user.uid !== rider.id ||
          riderId !== rider.id
        ) return;
        publishedLocationRef.current = null;
        setPublishedLocation(null);
        setLocationQuality(quality.quality);
        setLocationMessage(quality.message);
        lastRejectedIssue.current = quality.issue;
      });
    return () => {
      active = false;
      unsubscribePublished();
      unsubscribeRejectedLocation();
    };
  }, [rider?.id, user?.uid]);

  useEffect(() => {
    if (!publishedLocation) return;
    const timeoutMs = Math.max(
      0,
      publishedLocation.location.timestamp + MAX_RIDER_LOCATION_AGE_MS + 1 - Date.now(),
    );
    const timeout = setTimeout(() => {
      if (publishedLocationRef.current !== publishedLocation) return;
      publishedLocationRef.current = null;
      setPublishedLocation(null);
      setLocationQuality('stale');
      setLocationMessage('Location is stale. Waiting for a fresh device fix.');
      lastRejectedIssue.current =
        'GPS update is stale. Waiting for a fresh device location.';
    }, timeoutMs);
    return () => clearTimeout(timeout);
  }, [publishedLocation]);

  const showLocationServicesWarning = useCallback(() => {
    if (
      AppState.currentState !== 'active' ||
      alertVisible.current ||
      warnedCycle.current === foregroundCycle.current
    ) return;

    alertVisible.current = true;
    warnedCycle.current = foregroundCycle.current;
    Alert.alert(
      'Location Required',
      'Please turn on your device location services to continue using ' +
        'BasuraGo Rider. Your location is needed to report your position ' +
        'and support pickup assignments.',
      [
        {
          text: 'Turn On Location',
          onPress: () => {
            alertVisible.current = false;
            if (Platform.OS === 'android') {
              void Location.enableNetworkProviderAsync()
                .then(async () => {
                  if (await Location.hasServicesEnabledAsync()) {
                    updateLocationServicesEnabled(true);
                    warnedCycle.current = -1;
                    setLocationMessage(
                      'Location services are on. Go online to resume reporting.',
                    );
                  } else {
                    setLocationMessage(
                      'Location is still off. Turn it on in device Settings, ' +
                        'then return to BasuraGo Rider.',
                    );
                  }
                })
                .catch((error: unknown) => {
                  console.warn(
                    'Unable to open the Android location prompt:',
                    error,
                  );
                  Alert.alert(
                    'Turn on Location Services',
                    'Open your device Settings, choose Location, and turn ' +
                      'Location on. Then return to BasuraGo Rider.',
                    [{text: 'OK'}],
                  );
                });
            } else {
              void Linking.openSettings().catch((error: unknown) => {
                console.warn('Unable to open app settings:', error);
                Alert.alert(
                  'Turn on Location Services',
                  'Open your device Settings, choose Privacy & Security, ' +
                    'then Location Services, and turn it on. Return to ' +
                    'BasuraGo Rider when finished.',
                  [{text: 'OK'}],
                );
              });
            }
          },
        },
        {
          text: 'OK',
          style: 'cancel',
          onPress: () => {
            alertVisible.current = false;
          },
        },
      ],
      {
        cancelable: false,
        onDismiss: () => {
          alertVisible.current = false;
        },
      },
    );
  }, [updateLocationServicesEnabled]);

  const showPermissionWarning = useCallback((canAskAgain: boolean) => {
    if (
      AppState.currentState !== 'active' ||
      alertVisible.current ||
      warnedCycle.current === foregroundCycle.current
    ) return;

    alertVisible.current = true;
    warnedCycle.current = foregroundCycle.current;
    Alert.alert(
      'Location Permission Required',
      'BasuraGo Rider needs location permission to report your position. ' +
        (canAskAgain
          ? 'Allow location access to continue.'
          : 'Enable location permission for BasuraGo Rider in your device settings.'),
      [
        {
          text: canAskAgain ? 'Allow Location' : 'Open Settings',
          onPress: () => {
            alertVisible.current = false;
            const action = canAskAgain
              ? Location.requestForegroundPermissionsAsync()
              : Linking.openSettings();
            void action
              .then(async () => {
                const [permission, enabled] = await Promise.all([
                  Location.getForegroundPermissionsAsync(),
                  Location.hasServicesEnabledAsync(),
                ]);
                updateLocationServicesEnabled(enabled);
                if (permission.status === 'granted') {
                  warnedCycle.current = -1;
                  if (!enabled) showLocationServicesWarning();
                }
              })
              .catch((error: unknown) => {
                console.warn('Unable to update location permission:', error);
              });
          },
        },
        {
          text: 'OK',
          style: 'cancel',
          onPress: () => {
            alertVisible.current = false;
          },
        },
      ],
      {
        cancelable: false,
        onDismiss: () => {
          alertVisible.current = false;
        },
      },
    );
  }, [showLocationServicesWarning, updateLocationServicesEnabled]);

  const checkLocationServices = useCallback(async (): Promise<boolean> => {
    try {
      const [permission, servicesEnabled] = await Promise.all([
        Location.getForegroundPermissionsAsync(),
        Location.hasServicesEnabledAsync(),
      ]);
      updateLocationServicesEnabled(servicesEnabled);
      if (permission.status !== 'granted') {
        setLocationMessage(
          permission.canAskAgain
            ? 'Location permission is needed to report your position while online.'
            : 'Location permission is blocked. Enable it in device settings.',
        );
        showPermissionWarning(permission.canAskAgain);
        return false;
      }
      if (Platform.OS === 'android') {
        const backgroundPermission =
          await Location.getBackgroundPermissionsAsync();
        if (backgroundPermission.status !== 'granted') {
          setLocationMessage(
            'Allow background location access to keep sharing while the app is minimized or your screen is locked.',
          );
          return false;
        }
      }
      if (!servicesEnabled) {
        setLocationMessage(
          'Device location services are off. Turn them on to report your position.',
        );
        showLocationServicesWarning();
        return false;
      }

      warnedCycle.current = -1;
      if (!isOnline) {
        setLocationMessage(
          'Location sharing is off. Go online to share your live location.',
        );
      }
      return true;
    } catch (error) {
      updateLocationServicesEnabled(null);
      setLocationMessage(
        'Location status could not be checked. Reporting will retry.',
      );
      console.warn('Unable to check rider location readiness:', error);
      return false;
    }
  }, [
    isOnline,
    showLocationServicesWarning,
    showPermissionWarning,
    updateLocationServicesEnabled,
  ]);

  const waitForFreshLocation = useCallback((
    timeoutMs = RIDER_LOCATION_ACQUISITION_TIMEOUT_MS,
  ): Promise<Location.LocationObject> => {
    const cached = publishedLocationRef.current;
    if (
      cached?.riderId === rider?.id &&
      user?.uid === rider?.id &&
      isOnline &&
      getRiderLocationSampleIssue(cached.location) === null
    ) {
      return Promise.resolve(cached.location);
    }

    if (
      !foregroundWatcherActive.current &&
      !foregroundWatcherStarting.current
    ) {
      return Promise.reject(new Error(
        'High-accuracy location tracking is not active. Go online and retry when GPS tracking starts.',
      ));
    }

    return new Promise((resolve, reject) => {
      const waiter: LocationWaiter = {
        resolve,
        reject,
        timeout: setTimeout(() => {
          locationWaiters.current.delete(waiter);
          reject(new Error(
            lastRejectedIssue.current ??
              'No accurate GPS fix arrived in time. Move to an open area and try again.',
          ));
        }, timeoutMs),
      };
      locationWaiters.current.add(waiter);

      // Recheck after registration so a location published between the first
      // cache check and waiter setup can satisfy acceptance immediately.
      const latest = publishedLocationRef.current;
      if (
        latest?.riderId === rider?.id &&
        user?.uid === rider?.id &&
        isOnline &&
        getRiderLocationSampleIssue(latest.location) === null
      ) {
        clearTimeout(waiter.timeout);
        locationWaiters.current.delete(waiter);
        resolve(latest.location);
      }
    });
  }, [isOnline, rider?.id, user?.uid]);

  const rejectLocationWaiters = useCallback((message: string) => {
    for (const waiter of locationWaiters.current) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error(message));
    }
    locationWaiters.current.clear();
  }, []);

  useEffect(() => {
    if (
      !user ||
      !rider ||
      typeof user.uid !== 'string' ||
      !user.uid ||
      typeof rider.id !== 'string' ||
      !rider.id ||
      user.uid !== rider.id
    ) {
      setAvailability(null);
      return;
    }

    let active = true;
    const riderId = rider.id;
    const unsubscribe = onSnapshot(doc(db, 'riders', riderId), (snapshot) => {
      if (!active || !user || !rider || user.uid !== rider.id || rider.id !== riderId) return;
      const profile = snapshot.data();
      const eligible = snapshot.exists() && profile?.status === 'active';
      setAvailability({
        riderId,
        loaded: true,
        eligible,
        online: eligible && profile?.isOnline === true,
      });
      if (!eligible) {
        setLocationMessage(
          'Location sharing is unavailable for this rider account.',
        );
      } else if (
        profile?.isOnline !== true &&
        locationServicesEnabledRef.current !== false
      ) {
        setLocationMessage(
          'Location sharing is off. Go online to share your live location.',
        );
      }
    }, () => {
      if (!active || !user || !rider || user.uid !== rider.id || rider.id !== riderId) return;
      setAvailability({
        riderId,
        loaded: true,
        eligible: false,
        online: false,
      });
      setLocationMessage('Rider availability could not be verified. Location sharing is paused.');
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [rider, user]);

  useEffect(() => {
    if (
      !availabilityLoaded ||
      !riderEligible ||
      !rider ||
      user?.uid !== rider.id
    ) {
      return;
    }

    let active = true;
    let starting = false;
    let subscription: Location.LocationSubscription | null = null;
    let watchdog: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let publishing = false;
    let resumeAfterStartup = false;
    let lastPublishedAt = 0;
    let sessionStartedAt = Date.now();

    const isCurrentRider = () =>
      active &&
      user.uid === rider.id &&
      auth.currentUser?.uid === rider.id;
    const isCurrentRiderOnline = () =>
      isCurrentRider() && isOnline;
    const isCurrentSession = () =>
      isCurrentRiderOnline() &&
      AppState.currentState === 'active';

    const stopForegroundWatcher = () => {
      subscription?.remove();
      subscription = null;
      foregroundWatcherActive.current = false;
      if (watchdog) clearInterval(watchdog);
      watchdog = null;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      setLocationTracking(false);
      rejectLocationWaiters(
        'Foreground GPS tracking stopped before a reliable fix arrived. Return online and retry.',
      );
    };

    const stopWatcher = () => {
      stopForegroundWatcher();
      if (Platform.OS === 'android') {
        void stopRiderBackgroundLocation().catch((error: unknown) => {
          console.warn('Unable to stop Android background location:', error);
        });
      }
    };

    const setOffline = async (message: string) => {
      setLocationMessage(message);
      setLocationQuality('unavailable');
      publishedLocationRef.current = null;
      setPublishedLocation(null);
      stopWatcher();
      if (!isCurrentRider()) return;
      try {
        await updateRiderOnlineStatus(rider.id, false);
      } catch {
        console.warn('Unable to persist offline status after location stopped.');
      }
    };

    const publish = async (location: Location.LocationObject) => {
      if (
        publishing ||
        !isCurrentSession() ||
        AppState.currentState !== 'active'
      ) return;

      const {latitude, longitude, accuracy} = location.coords;
      const mapQuality = getRiderMapLocationQuality(location);
      if (mapQuality.issue) {
        lastRejectedIssue.current = mapQuality.issue;
        publishedLocationRef.current = null;
        setPublishedLocation(null);
        setLocationQuality(mapQuality.quality);
        setLocationMessage(mapQuality.message);
        const accuracy = location.coords?.accuracy;
        const now = Date.now();
        if (__DEV__ && now - lastRejectedLogAt.current >= 15_000) {
          lastRejectedLogAt.current = now;
          const accuracy = location.coords?.accuracy;
          console.warn('Foreground rider location sample rejected.', {
            accuracyMeters: typeof accuracy === 'number' &&
              Number.isFinite(accuracy) ? accuracy : null,
            ageSeconds: Number.isFinite(location.timestamp)
              ? Math.round((now - location.timestamp) / 100) / 10
              : null,
            validationIssue: mapQuality.issue,
          });
        }
        return;
      }
      const acceptanceIssue = getRiderLocationSampleIssue(location);
      lastRejectedIssue.current = acceptanceIssue;
      if (lastPublishedAt && Date.now() - lastPublishedAt < 15000) return;

      publishing = true;
      try {
        await saveRiderLocation(
          rider.id,
          latitude,
          longitude,
          accuracy ?? null,
          location.timestamp,
        );
        if (!isCurrentSession()) return;
        lastPublishedAt = Date.now();
        const published = {riderId: rider.id, location};
        publishedLocationRef.current = published;
        setPublishedLocation(published);
        setLocationQuality(mapQuality.quality);
        setLocationMessage(mapQuality.message);
        if (acceptanceIssue === null) {
          for (const waiter of locationWaiters.current) {
            clearTimeout(waiter.timeout);
            waiter.resolve(location);
          }
          locationWaiters.current.clear();
        }
        console.info('Rider location publication succeeded.');
      } catch (error) {
        if (!isCurrentSession()) return;
        const code = typeof error === 'object' && error !== null &&
          'code' in error ? String(error.code) : '';
        if (code === 'functions/permission-denied') {
          void setOffline(
            'Location sharing stopped because this rider account is inactive or offline.',
          );
          return;
        }
        console.warn('Rider GPS publication failed; waiting for the next location update.');
        setLocationMessage('GPS update could not be sent. Retrying when a new position is available.');
      } finally {
        publishing = false;
      }
    };

    const startWatcher = async () => {
      if (!isCurrentSession() || starting || subscription) return;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      starting = true;
      foregroundWatcherStarting.current = true;
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!isCurrentSession()) return;
        if (permission.status !== 'granted') {
          showPermissionWarning(permission.canAskAgain);
          await setOffline('Location permission is required while you are online.');
          return;
        }
        if (Platform.OS === 'android') {
          const backgroundPermission =
            await Location.getBackgroundPermissionsAsync();
          if (!isCurrentSession()) return;
          if (backgroundPermission.status !== 'granted') {
            await setOffline(
              'Background location permission is required while you are online. ' +
                'Go offline, allow background access in Settings, then go online again.',
            );
            return;
          }
          const providerStatus = await Location.getProviderStatusAsync();
          if (!isCurrentSession()) return;
          if (!providerStatus.gpsAvailable) {
            setLocationTracking(false);
            foregroundWatcherActive.current = false;
            setLocationMessage(
              'Device GPS is turned off. Enable GPS in Android Location settings to obtain a more accurate fix.',
            );
            await stopRiderBackgroundLocation().catch((error: unknown) => {
              console.warn('Unable to stop location while device GPS is off:', error);
            });
            return;
          }
        }
        if (!(await Location.hasServicesEnabledAsync())) {
          if (isCurrentSession()) {
            updateLocationServicesEnabled(false);
            showLocationServicesWarning();
            await setOffline('Device location is off. Location sharing has stopped.');
          }
          return;
        }
        updateLocationServicesEnabled(true);
        warnedCycle.current = -1;

        if (Platform.OS === 'android') {
          await startRiderBackgroundLocation();
          if (!isCurrentRiderOnline()) {
            await stopRiderBackgroundLocation();
            return;
          }
          foregroundWatcherActive.current = true;
          setLocationTracking(true);
          setLocationMessage(
            'High-accuracy location sharing is active while you are online. ' +
              'Only fresh fixes that meet the accuracy requirement are published.',
          );
          return;
        }

        sessionStartedAt = Date.now();
        lastPublishedAt = 0;
        if (Platform.OS !== 'android') {
          const initial = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            mayShowUserSettingsDialog: true,
          });
          if (!isCurrentSession()) return;
          await publish(initial);
          if (!isCurrentSession()) return;
        }

        const nextSubscription = await Location.watchPositionAsync(
          LOCATION_OPTIONS,
          (location) => {
            void publish(location);
          },
        );
        if (!isCurrentSession()) {
          nextSubscription.remove();
          return;
        }
        subscription = nextSubscription;
        foregroundWatcherActive.current = true;
        setLocationTracking(true);
        setLocationMessage(
          Platform.OS === 'android' ?
            'High-accuracy GPS acquisition is active. Location is sent only ' +
              'when the fix meets the accuracy requirement.' :
            'Live location is reporting while this app is open.',
        );
        watchdog = setInterval(() => {
          void Promise.all([
            Location.hasServicesEnabledAsync(),
            Location.getForegroundPermissionsAsync(),
          ]).then(async ([servicesEnabled, currentPermission]) => {
            if (!isCurrentSession()) return;
            updateLocationServicesEnabled(servicesEnabled);
            if (!servicesEnabled) {
              showLocationServicesWarning();
              await setOffline(
                'Device location services were turned off. Live reporting has stopped.',
              );
              return;
            }
            if (currentPermission.status !== 'granted') {
              showPermissionWarning(currentPermission.canAskAgain);
              await setOffline(
                'Location permission was removed. Live reporting has stopped.',
              );
              return;
            }
            const lastUpdate = lastPublishedAt || sessionStartedAt;
            if (Date.now() - lastUpdate > 60000) {
              stopWatcher();
              setLocationMessage('GPS updates are delayed. Reconnecting location reporting while you remain online.');
              console.warn('Rider location watchdog detected stale updates.');
              retryTimer = setTimeout(() => {
                retryTimer = null;
                void startWatcher();
              }, 1000);
            }
          }).catch(() => {
            if (isCurrentSession()) {
              updateLocationServicesEnabled(null);
              setLocationMessage('Location status could not be checked. Reporting will retry.');
            }
          });
        }, 10000);
      } catch (trackingError) {
        if (!isCurrentRiderOnline()) return;
        console.warn('Unable to start rider location reporting:', trackingError);
        try {
          const [servicesEnabled, permission] = await Promise.all([
            Location.hasServicesEnabledAsync(),
            Location.getForegroundPermissionsAsync(),
          ]);
          if (!servicesEnabled) {
            updateLocationServicesEnabled(false);
            showLocationServicesWarning();
            await setOffline(
              'Device location services are off. Location sharing has stopped.',
            );
            return;
          }
          if (permission.status !== 'granted') {
            showPermissionWarning(permission.canAskAgain);
            await setOffline(
              'Location permission is required while you are online.',
            );
            return;
          }
          updateLocationServicesEnabled(true);
        } catch (checkError) {
          console.warn(
            'Unable to verify location after a tracking failure:',
            checkError,
          );
        }
        if (!isCurrentRiderOnline()) return;
        setLocationMessage('Location reporting paused temporarily. Reconnecting while you remain online.');
        retryTimer = setTimeout(() => {
          retryTimer = null;
          void startWatcher();
        }, 5000);
      } finally {
        starting = false;
        foregroundWatcherStarting.current = false;
        if (
          resumeAfterStartup &&
          active &&
          AppState.currentState === 'active'
        ) {
          resumeAfterStartup = false;
          void startWatcher();
        }
      }
    };

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        foregroundCycle.current += 1;
        resumeAfterStartup = starting;
        void checkLocationServices().then((ready) => {
          if (
            isOnline &&
            (ready || Platform.OS === 'android')
          ) {
            void startWatcher();
          }
        });
      } else {
        resumeAfterStartup = starting;
        if (Platform.OS !== 'android') stopForegroundWatcher();
        if (isOnline) {
          setLocationMessage(
            Platform.OS === 'android' ?
              'Background location sharing continues while you are online.' :
              'Location reporting paused while the app is in the background. It will resume when you return.',
          );
          if (Platform.OS !== 'android') {
            publishedLocationRef.current = null;
            setPublishedLocation(null);
          }
        }
      }
    };

    if (AppState.currentState === 'active') {
      void Promise.resolve()
        .then(() => checkLocationServices())
        .then((ready) => {
          if (isOnline && (ready || Platform.OS === 'android')) {
            void startWatcher();
          }
        });
    }
    const appStateSubscription = AppState.addEventListener(
      'change',
      onAppStateChange,
    );

    return () => {
      active = false;
      appStateSubscription.remove();
      stopWatcher();
    };
  }, [
    availabilityLoaded,
    checkLocationServices,
    isOnline,
    rider,
    riderEligible,
    showLocationServicesWarning,
    showPermissionWarning,
    rejectLocationWaiters,
    updateLocationServicesEnabled,
    user,
  ]);

  return (
    <RiderLocationContext.Provider
      value={{
        isOnline,
        availabilityLoaded,
        locationTracking,
        latestLocation:
          isOnline &&
          user?.uid === rider?.id &&
          publishedLocation?.riderId === rider?.id
            ? publishedLocation.location
            : null,
        locationQuality,
        locationServicesEnabled,
        locationMessage,
        waitForFreshLocation,
        checkLocationServices,
        setLocationMessage,
      }}
    >
      {children}
    </RiderLocationContext.Provider>
  );
}

export function useRiderLocation() {
  const context = useContext(RiderLocationContext);
  if (!context) {
    throw new Error(
      'useRiderLocation must be used inside RiderLocationProvider',
    );
  }
  return context;
}
