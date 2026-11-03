import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import * as Location from 'expo-location';
import RemixIcon from 'react-native-remix-icon';

import {getPickupRoute} from '../../services/firebase/pickups/route.services';
import type {Pickup} from '../../services/firebase/pickups/pickup.types';

interface PickupRouteMapProps {
  pickup: Pickup;
  riderId: string | undefined;
  isActive: boolean;
}

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface RouteInfo {
  coordinates: Coordinate[];
  distanceMeters: number;
  durationSeconds: number;
}

const ROUTE_REFRESH_DISTANCE_METERS = 100;
const ROUTE_REFRESH_MIN_INTERVAL_MS = 35_000;

const MAP_STYLE = [
  {elementType: 'geometry', stylers: [{color: '#f0f1ef'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#69736d'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#f7f8f6'}]},
  {featureType: 'administrative', elementType: 'geometry', stylers: [{color: '#d3d8d3'}]},
  {featureType: 'landscape', elementType: 'geometry', stylers: [{color: '#f0f1ef'}]},
  {featureType: 'poi', elementType: 'geometry', stylers: [{color: '#e3e7e3'}]},
  {featureType: 'poi', elementType: 'labels.text.fill', stylers: [{color: '#77817a'}]},
  {featureType: 'road', elementType: 'geometry', stylers: [{color: '#ffffff'}]},
  {featureType: 'road', elementType: 'geometry.stroke', stylers: [{color: '#d6dad6'}]},
  {featureType: 'road', elementType: 'labels.text.fill', stylers: [{color: '#68726b'}]},
  {featureType: 'transit', elementType: 'geometry', stylers: [{color: '#e1e5e1'}]},
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#dce5e4'}]},
];

function decodePolyline(encoded: string): Coordinate[] {
  const coordinates: Coordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    latitude += (result & 1) ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    longitude += (result & 1) ? ~(result >> 1) : result >> 1;
    coordinates.push({latitude: latitude / 1e5, longitude: longitude / 1e5});
  }
  return coordinates;
}

function distanceMeters(first: Coordinate, second: Coordinate): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

export default function PickupRouteMap({
  pickup,
  riderId,
  isActive,
}: PickupRouteMapProps) {
  const destination = pickup.pickupLocation ?? null;
  const mapsConfigured = Platform.OS !== 'android' ||
    Constants.expoConfig?.extra?.googleMapsAndroidApiKeyConfigured === true;
  const [riderLocation, setRiderLocation] = useState<Coordinate | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [message, setMessage] = useState('');
  const [routeError, setRouteError] = useState('');
  const [locationSettingsNeeded, setLocationSettingsNeeded] = useState(false);
  const [retryAvailableAt, setRetryAvailableAt] = useState<number | null>(null);
  const [retryCooldownSeconds, setRetryCooldownSeconds] = useState(0);
  const [lastRoutedOrigin, setLastRoutedOrigin] = useState<{
    routeKey: string;
    origin: Coordinate;
  } | null>(null);
  const mapRef = useRef<MapView>(null);
  const routeRequestsInProgress = useRef(new Set<string>());
  const lastRoutedLocation = useRef<{
    routeKey: string;
    origin: Coordinate;
  } | null>(null);
  const lastRouteAttempts = useRef(new Map<string, {
    origin: Coordinate;
    requestedAt: number;
  }>());
  const routeKey = [
    pickup.id,
    riderId ?? '',
    destination?.latitude ?? '',
    destination?.longitude ?? '',
  ].join(':');
  const currentRouteKey = useRef(routeKey);

  const region = useMemo<Region | null>(() => destination ? ({
    latitude: destination.latitude,
    longitude: destination.longitude,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  }) : null, [destination]);

  const requestRoute = useCallback(async (origin: Coordinate) => {
    if (!isActive || !riderId || routeRequestsInProgress.current.has(routeKey)) return;
    const now = Date.now();
    const previousAttempt = lastRouteAttempts.current.get(routeKey);
    if (previousAttempt &&
      now - previousAttempt.requestedAt < ROUTE_REFRESH_MIN_INTERVAL_MS) return;
    if (
      lastRoutedLocation.current?.routeKey === routeKey &&
      distanceMeters(lastRoutedLocation.current.origin, origin) <
        ROUTE_REFRESH_DISTANCE_METERS
    ) return;

    routeRequestsInProgress.current.add(routeKey);
    lastRouteAttempts.current.set(routeKey, {origin, requestedAt: now});
    setRetryAvailableAt(now + ROUTE_REFRESH_MIN_INTERVAL_MS);
    setRetryCooldownSeconds(Math.ceil(ROUTE_REFRESH_MIN_INTERVAL_MS / 1000));
    setLoadingRoute(true);
    setRouteError('');
    try {
      const result = await getPickupRoute(pickup.id, origin);
      const coordinates = decodePolyline(result.encodedPolyline);
      if (coordinates.length < 2) {
        throw new Error('The route service returned an invalid route.');
      }
      if (currentRouteKey.current !== routeKey) return;
      lastRoutedLocation.current = {routeKey, origin};
      setLastRoutedOrigin({routeKey, origin});
      setRoute({
        coordinates,
        distanceMeters: result.distanceMeters,
        durationSeconds: result.durationSeconds,
      });
    } catch (error) {
      if (currentRouteKey.current !== routeKey) return;
      console.error('Unable to calculate pickup road route:', error);
      setRouteError('Route details are unavailable. Try again or open Google Maps directions.');
    } finally {
      routeRequestsInProgress.current.delete(routeKey);
      if (currentRouteKey.current === routeKey) setLoadingRoute(false);
    }
  }, [isActive, pickup.id, riderId, routeKey]);

  useLayoutEffect(() => {
    currentRouteKey.current = routeKey;
    return () => {
      if (currentRouteKey.current === routeKey) {
        currentRouteKey.current = '';
      }
    };
  }, [routeKey]);

  useEffect(() => {
    if (retryAvailableAt === null) {
      return;
    }

    const timer = setInterval(() => {
      const secondsRemaining = Math.max(
        0,
        Math.ceil((retryAvailableAt - Date.now()) / 1000),
      );
      setRetryCooldownSeconds(secondsRemaining);
      if (secondsRemaining === 0) setRetryAvailableAt(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAvailableAt]);

  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    async function startForegroundLocation() {
      setLoadingLocation(true);
      setLoadingRoute(false);
      setMessage('');
      setLocationSettingsNeeded(false);
      setRouteError('');
      setRoute(null);
      setRiderLocation(null);

      if (!destination) {
        setMessage('Pickup coordinates are missing or invalid. Ask dispatch to correct the pickup address.');
        setLoadingLocation(false);
        return;
      }
      if (!mapsConfigured) {
        setMessage('Google Maps is not configured for this build. Use the external directions action below.');
        setLoadingLocation(false);
        return;
      }
      if (!isActive || !riderId) {
        setMessage('Route details are available after this pickup is assigned to you and accepted.');
        setLoadingLocation(false);
        return;
      }

      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          const requested = await Location.requestForegroundPermissionsAsync();
          if (requested.status !== 'granted') {
            setMessage(requested.canAskAgain
              ? 'Location permission is needed to show your position and calculate the route.'
              : 'Location permission is blocked. Enable it in device settings to use the route map.');
            setLocationSettingsNeeded(!requested.canAskAgain);
            return;
          }
        }
        if (!(await Location.hasServicesEnabledAsync())) {
          setMessage('Device location is off. Turn on GPS to show your position and route.');
          setLocationSettingsNeeded(true);
          return;
        }
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (!active) return;
        const initialCoordinate = {
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
        };
        setRiderLocation(initialCoordinate);
        void requestRoute(initialCoordinate);

        subscription = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 15_000,
          distanceInterval: 25,
        }, (location) => {
          const coordinate = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          if (
            !Number.isFinite(coordinate.latitude) ||
            coordinate.latitude < -90 || coordinate.latitude > 90 ||
            !Number.isFinite(coordinate.longitude) ||
            coordinate.longitude < -180 || coordinate.longitude > 180
          ) return;
          setRiderLocation(coordinate);
          const previousRouteOrigin =
            lastRoutedLocation.current?.routeKey === routeKey
              ? lastRoutedLocation.current.origin
              : null;
          const previousAttempt = lastRouteAttempts.current.get(routeKey);
          const cooldownElapsed =
            !previousAttempt ||
            Date.now() - previousAttempt.requestedAt >=
              ROUTE_REFRESH_MIN_INTERVAL_MS;
          if (
            (!previousRouteOrigin ||
              distanceMeters(previousRouteOrigin, coordinate) >=
                ROUTE_REFRESH_DISTANCE_METERS) &&
            cooldownElapsed
          ) {
            void requestRoute(coordinate);
          }
        });
      } catch (error) {
        console.error('Unable to start foreground pickup location:', error);
        if (active) setMessage('GPS is unavailable right now. Check location settings and try again.');
      } finally {
        if (active) setLoadingLocation(false);
      }
    }

    void startForegroundLocation();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [
    destination,
    isActive,
    mapsConfigured,
    pickup.id,
    requestRoute,
    riderId,
    routeKey,
  ]);

  useEffect(() => {
    if (!riderLocation || !destination) return;
    mapRef.current?.fitToCoordinates([riderLocation, destination], {
      edgePadding: {top: 55, right: 45, bottom: 55, left: 45},
      animated: true,
    });
  }, [destination, riderLocation]);

  const retryRoute = () => {
    if (riderLocation && retryCooldownSeconds === 0) {
      void requestRoute(riderLocation);
    }
  };
  const retryNeedsMovement = !!riderLocation &&
    lastRoutedOrigin?.routeKey === routeKey &&
    distanceMeters(lastRoutedOrigin.origin, riderLocation) <
      ROUTE_REFRESH_DISTANCE_METERS;
  const retryDisabled = retryCooldownSeconds > 0 || retryNeedsMovement;

  const navigateToPickup = async () => {
    if (
      !destination ||
      !Number.isFinite(destination.latitude) ||
      destination.latitude < -90 ||
      destination.latitude > 90 ||
      !Number.isFinite(destination.longitude) ||
      destination.longitude < -180 ||
      destination.longitude > 180
    ) {
      Alert.alert(
        'Pickup location unavailable',
        'The customer pickup does not have valid map coordinates.',
      );
      return;
    }

    const url = 'https://www.google.com/maps/dir/?api=1' +
      `&destination=${destination.latitude},${destination.longitude}` +
      '&travelmode=driving';
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'Navigation unavailable',
        'Unable to open Google Maps directions on this device.',
      );
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Pickup route</Text>
          <Text style={styles.subtitle}>Road directions to the pickup point</Text>
        </View>
        <View style={styles.headingActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Navigate to customer pickup"
            onPress={() => void navigateToPickup()}
            style={styles.navigationIconButton}
          >
            <RemixIcon
              name="navigation-line"
              size={20}
              color="#176744"
              accessible={false}
            />
          </Pressable>
          {loadingRoute ? <ActivityIndicator color="#176744" /> : null}
        </View>
      </View>

      {destination && region && mapsConfigured ? (
        <View style={styles.mapFrame}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            customMapStyle={MAP_STYLE}
            onMapReady={() => console.info('[PickupRouteMap] Map ready')}
            onMapLoaded={() => console.info('[PickupRouteMap] Map tiles loaded')}
            showsCompass
            showsScale
            showsUserLocation={false}
            toolbarEnabled={false}
          >
            <Marker
              coordinate={destination}
              title="Customer pickup"
              description={pickup.pickupAddress}
              anchor={{x: 0.5, y: 0.5}}
            >
              <View style={styles.destinationMarker}><View style={styles.destinationMarkerCore} /></View>
            </Marker>
            {riderLocation ? (
              <Marker coordinate={riderLocation} title="Your location" anchor={{x: 0.5, y: 0.5}}>
                <View style={styles.riderMarkerHalo}>
                  <View style={styles.riderMarker}>
                    <View style={styles.riderMarkerCore} />
                  </View>
                </View>
              </Marker>
            ) : null}
            {route ? (
              <Polyline coordinates={route.coordinates} strokeColor="#16834A" strokeWidth={6} />
            ) : null}
          </MapView>
          {!riderLocation && (loadingLocation || message) ? (
            <View style={styles.mapOverlay}>
              {loadingLocation ? <ActivityIndicator color="#176744" /> : null}
              {message ? <Text style={styles.overlayText}>{message}</Text> : null}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.noMap}><Text style={styles.stateText}>{message || 'Pickup coordinates are not available.'}</Text></View>
      )}

      <Text style={styles.addressLabel}>CUSTOMER PICKUP</Text>
      <Text style={styles.address}>{pickup.pickupAddress || 'Pickup address unavailable'}</Text>

      {route ? (
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{route.distanceMeters >= 1000
              ? `${(route.distanceMeters / 1000).toFixed(1)} km`
              : `${Math.round(route.distanceMeters)} m`}</Text>
            <Text style={styles.metricLabel}>ROAD DISTANCE</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{formatDuration(route.durationSeconds)}</Text>
            <Text style={styles.metricLabel}>EST. DRIVE TIME</Text>
          </View>
        </View>
      ) : null}

      {message && riderLocation ? <Text style={styles.stateText}>{message}</Text> : null}
      {routeError ? <Text style={styles.errorText}>{routeError}</Text> : null}
      {(locationSettingsNeeded || routeError) ? (
        routeError && riderLocation ? (
          <>
            {retryCooldownSeconds > 0 ? (
              <Text style={styles.stateText}>
                Retry available in {retryCooldownSeconds} seconds.
              </Text>
            ) : retryNeedsMovement ? (
              <Text style={styles.stateText}>
                Move at least {ROUTE_REFRESH_DISTANCE_METERS} m before requesting another route.
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{disabled: retryDisabled}}
              disabled={retryDisabled}
              style={[
                styles.secondaryButton,
                retryDisabled && styles.secondaryButtonDisabled,
              ]}
              onPress={retryRoute}
            >
              <Text style={styles.secondaryButtonText}>Retry route</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={styles.secondaryButton}
            onPress={() => void Linking.openSettings()}
          >
            <Text style={styles.secondaryButtonText}>Open location settings</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {padding: 17, marginBottom: 14, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6EDE7'},
  headingRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13},
  headingCopy: {flex: 1},
  headingActions: {flexDirection: 'row', alignItems: 'center', gap: 10},
  navigationIconButton: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#E8F5EC'},
  title: {color: '#1D2C22', fontSize: 16, fontWeight: '800'},
  subtitle: {marginTop: 4, color: '#7A887E', fontSize: 11},
  mapFrame: {height: 290, overflow: 'hidden', borderRadius: 22, backgroundColor: '#E9EDEA', borderWidth: 1, borderColor: '#DDE5DF'},
  map: {flex: 1},
  mapOverlay: {position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.94)'},
  overlayText: {color: '#68766D', fontSize: 11, lineHeight: 16, textAlign: 'center'},
  destinationMarker: {width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#C13D3D', borderWidth: 3, borderColor: '#FFFFFF', elevation: 4},
  destinationMarkerCore: {width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF'},
  riderMarkerHalo: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(33,138,82,0.20)'},
  riderMarker: {width: 27, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#218A52', borderWidth: 3, borderColor: '#FFFFFF', elevation: 5},
  riderMarkerCore: {width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF'},
  noMap: {minHeight: 130, alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 15, backgroundColor: '#F5F8F6'},
  addressLabel: {marginTop: 15, color: '#829087', fontSize: 9, fontWeight: '800', letterSpacing: 1.1},
  address: {marginTop: 5, color: '#26362B', fontSize: 13, fontWeight: '600', lineHeight: 19},
  metricsRow: {flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingVertical: 13, borderRadius: 13, backgroundColor: '#F5F8F6'},
  metric: {flex: 1, alignItems: 'center'},
  metricValue: {color: '#176744', fontSize: 16, fontWeight: '900'},
  metricLabel: {marginTop: 4, color: '#849087', fontSize: 8, fontWeight: '800', letterSpacing: 0.8},
  metricDivider: {width: 1, height: 30, backgroundColor: '#DCE5DD'},
  stateText: {marginTop: 10, color: '#76837A', fontSize: 11, lineHeight: 16, textAlign: 'center'},
  errorText: {marginTop: 10, color: '#A23B32', fontSize: 11, lineHeight: 16},
  secondaryButton: {alignSelf: 'flex-start', marginTop: 11, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#E8F5EC'},
  secondaryButtonDisabled: {opacity: 0.55},
  secondaryButtonText: {color: '#176744', fontSize: 11, fontWeight: '800'},
});
