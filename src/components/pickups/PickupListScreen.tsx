import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { ActivityIndicator, Alert, Animated, AppState, Easing, FlatList, Modal, PanResponder, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import MapView, {
  Circle,
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import { useAuth } from '../../contexts/AuthContext/AuthContext';
import { useRiderLocation } from '../../contexts/RiderLocationContext/RiderLocationContext';
import {
  createRiderLocationPublishInput,
  getRiderMapLocationQuality,
  getRiderMapLocationSampleIssue,
  RIDER_LOCATION_ACQUISITION_TIMEOUT_MS,
} from '../../services/location/locationQuality';
import {
  getAvailablePickupsPage,
  getPickupTrashPhotoUrls,
  getMyActivePickupCount,
  getMyPickups,
  getMyPickupsPage,
  getPickupHistoryCount,
  getPickupHistoryPage,
  type MyPickupStatusFilter,
  type MyPickupsPageCursor,
  type PickupHistoryStatusFilter,
  type PickupTrashPhotoUrl,
} from '../../services/firebase/pickups/pickup.services';
import type { Pickup } from '../../services/firebase/pickups/pickup.types';
import { acceptPickup } from '../../services/firebase/pickups/pickup-acceptance.services';
import RemixIcon from 'react-native-remix-icon';
import PickupCard from './PickupCard';
import MyPickupCard from './MyPickupCard';
import PickupHistoryCard from './PickupHistoryCard';
import BottomNav from '../common/BottomNav';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export type PickupListMode = 'available' | 'mine' | 'history';

type Coordinates = { latitude: number; longitude: number };
type RiderMapPosition = Coordinates & {
  accuracyMeters: number;
  timestamp: number;
};

function TrashPhotoThumbnail({
  photo,
  index,
  onPress,
}: {
  photo: PickupTrashPhotoUrl;
  index: number;
  onPress: () => void;
}) {
  const imageUrl = (photo.thumbnailUrl || photo.signedUrl).trim();
  const hasImageUrl = /^https?:\/\/\S+$/i.test(imageUrl);
  const [loading, setLoading] = useState(hasImageUrl);
  const [failed, setFailed] = useState(!hasImageUrl);

  useEffect(() => {
    setLoading(hasImageUrl);
    setFailed(!hasImageUrl);
  }, [hasImageUrl, imageUrl]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View trash photo ${index + 1}`}
      onPress={onPress}
    >
      <View style={styles.trashPhotoThumbnail}>
        {!failed ? (
          <Image
            source={{uri: imageUrl}}
            accessibilityLabel={`Trash photo ${index + 1}`}
            style={styles.trashPhotoImage}
            cachePolicy="memory"
            recyclingKey={photo.path}
            transition={100}
            onLoadStart={() => setLoading(true)}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
          />
        ) : (
          <View style={styles.trashPhotoFallback}>
            <RemixIcon name="image-line" size={20} color="#87948A" />
            <Text style={styles.trashPhotoFallbackText}>Photo unavailable</Text>
          </View>
        )}
        {loading && !failed ? (
          <View style={styles.trashPhotoImageLoading}>
            <ActivityIndicator size="small" color="#176744" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function TrashPhotoGalleryModal({
  visible,
  photos,
  index,
  onClose,
  onIndexChange,
}: {
  visible: boolean;
  photos: PickupTrashPhotoUrl[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const {width} = useWindowDimensions();
  const listRef = useRef<FlatList<PickupTrashPhotoUrl>>(null);

  useEffect(() => {
    if (visible && photos.length > 0) {
      listRef.current?.scrollToOffset({offset: index * width, animated: false});
    }
  }, [index, photos.length, visible, width]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.galleryScreen}>
        <View style={styles.galleryHeader}>
          <Text style={styles.galleryCounter}>
            {photos.length > 0 ? `${index + 1} / ${photos.length}` : ''}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo gallery"
            onPress={onClose}
            style={styles.galleryCloseButton}
          >
            <RemixIcon name="close-line" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
        {photos.length > 0 ? (
          <FlatList
            key={`gallery-${width}`}
            ref={listRef}
            data={photos}
            horizontal
            pagingEnabled
            style={styles.galleryList}
            initialScrollIndex={index}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(photo) => photo.path}
            getItemLayout={(_, itemIndex) => ({
              length: width,
              offset: width * itemIndex,
              index: itemIndex,
            })}
            onScrollToIndexFailed={({index: failedIndex}) => {
              listRef.current?.scrollToOffset({
                offset: width * failedIndex,
                animated: false,
              });
            }}
            onMomentumScrollEnd={(event) => {
              onIndexChange(Math.round(
                event.nativeEvent.contentOffset.x / width,
              ));
            }}
            renderItem={({item, index: itemIndex}) => (
              <GalleryPhotoSlide
                photo={item}
                index={itemIndex}
                width={width}
              />
            )}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function GalleryPhotoSlide({
  photo,
  index,
  width,
}: {
  photo: PickupTrashPhotoUrl;
  index: number;
  width: number;
}) {
  const imageUrl = photo.signedUrl.trim();
  const hasImageUrl = /^https?:\/\/\S+$/i.test(imageUrl);
  const [loading, setLoading] = useState(hasImageUrl);
  const [failed, setFailed] = useState(!hasImageUrl);

  useEffect(() => {
    setLoading(hasImageUrl);
    setFailed(!hasImageUrl);
  }, [hasImageUrl, imageUrl]);

  return (
    <View style={[styles.gallerySlide, {width}]}>
      {failed ? (
        <View style={styles.galleryError}>
          <RemixIcon name="image-line" size={38} color="#BBC5BE" />
          <Text style={styles.galleryErrorText}>This photo could not be loaded.</Text>
        </View>
      ) : (
        <Image
          source={{uri: imageUrl}}
          accessibilityLabel={`Trash photo ${index + 1}`}
          contentFit="contain"
          style={styles.galleryImage}
          cachePolicy="memory"
          recyclingKey={photo.path}
          transition={100}
          onLoadStart={() => setLoading(true)}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      )}
      {loading && !failed ? (
        <View style={styles.galleryLoading}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}

const MAP_STYLE = [
  {elementType: 'geometry', stylers: [{color: '#f1f3f1'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#606861'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#f7f8f7'}]},
  {featureType: 'road', elementType: 'geometry', stylers: [{color: '#ffffff'}]},
  {featureType: 'road.highway', elementType: 'geometry', stylers: [{color: '#dfe4df'}]},
  {featureType: 'road.arterial', elementType: 'geometry', stylers: [{color: '#e8ebe8'}]},
  {featureType: 'poi', elementType: 'geometry', stylers: [{color: '#e5ebe5'}]},
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#e4e9e6'}]},
];

const pageCopy: Record<PickupListMode, { title: string; subtitle: string; emptyTitle: string; emptyMessage: string }> = {
  available: { title: 'Available Pickups', subtitle: 'Review new requests and accept the collections you can complete.', emptyTitle: 'No available pickups', emptyMessage: 'New collection requests will appear here when they are available.' },
  mine: { title: 'My Pickups', subtitle: 'Manage the collections assigned to you from acceptance to completion.', emptyTitle: 'No active pickups', emptyMessage: 'Pickups you accept will appear here until they are completed.' },
  history: { title: 'Pickup History', subtitle: 'Review completed and cancelled collections.', emptyTitle: 'No pickup history yet', emptyMessage: 'Completed and cancelled pickups will appear here for reference.' },
};

const myPickupFilters: {label: string; value: MyPickupStatusFilter}[] = [
  {label: 'All', value: 'all'},
  {label: 'In progress', value: 'in_progress'},
  {label: 'Accepted', value: 'accepted'},
  {label: 'Pending', value: 'pending'},
  {label: 'Awaiting facility receipt', value: 'awaiting_facility_receipt'},
];

const pickupHistoryFilters: {
  label: string;
  value: PickupHistoryStatusFilter;
}[] = [
  {label: 'All', value: 'all'},
  {label: 'Completed', value: 'completed'},
  {label: 'Cancelled', value: 'cancelled'},
];

function hasCoordinates(pickup: Pickup): pickup is Pickup & { pickupLocation: Coordinates } {
  const location = pickup.pickupLocation;
  return Boolean(
    location &&
      Number.isFinite(location.latitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      Number.isFinite(location.longitude) &&
      location.longitude >= -180 &&
      location.longitude <= 180,
  );
}

function getDistanceKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(to.latitude - from.latitude);
  const lonDelta = toRadians(to.longitude - from.longitude);
  const startLat = toRadians(from.latitude);
  const endLat = toRadians(to.latitude);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPickupLoadErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code.replace(/^(functions|firestore)\//, '')
      : '';

  if (code === 'permission-denied') {
    return 'Your rider account is not authorized to view these pickups. Contact an administrator if this seems wrong.';
  }
  if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) {
    return 'You appear to be offline. Check your connection and try again.';
  }
  return 'We could not load this list. Please try again.';
}

type MappedPickup = Pickup & { pickupLocation: Coordinates };

function getInitialMapRegion(pickups: MappedPickup[]): Region {
  const latitudes = pickups.map((pickup) => pickup.pickupLocation.latitude);
  const longitudes = pickups.map((pickup) => pickup.pickupLocation.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max((maxLatitude - minLatitude) * 1.5, 0.015),
    longitudeDelta: Math.max((maxLongitude - minLongitude) * 1.5, 0.015),
  };
}

function PickupLocationsMap({
  pickups,
  selectedPickupId,
  riderLocation,
  onSelectPickup,
  initialRegion: savedRegion,
  onRegionChangeComplete,
  fullScreen = false,
}: {
  pickups: MappedPickup[];
  selectedPickupId: string | null;
  riderLocation: RiderMapPosition | null;
  onSelectPickup: (pickupId: string) => void;
  initialRegion?: Region | null;
  onRegionChangeComplete?: (region: Region) => void;
  fullScreen?: boolean;
}) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const mapsConfigured = Platform.OS !== 'android' ||
    Constants.expoConfig?.extra?.googleMapsAndroidApiKeyConfigured === true;
  const initialRegion = savedRegion ?? getInitialMapRegion(pickups);

  useEffect(() => {
    if (!mapsConfigured || mapLoaded) return;
    const timeout = setTimeout(() => {
      setMapFailed(true);
    }, 12_000);
    return () => clearTimeout(timeout);
  }, [mapsConfigured, mapLoaded, retryKey]);

  const retryMap = () => {
    setMapLoaded(false);
    setMapFailed(false);
    setRetryKey((current) => current + 1);
  };

  if (pickups.length === 0) {
    return (
      <View style={[styles.mapCanvas, fullScreen && styles.fullScreenMapCanvas, styles.mapState]}>
        <Text style={styles.mapEmpty}>
          No pickup requests have valid map coordinates yet.
        </Text>
      </View>
    );
  }

  if (!mapsConfigured) {
    return (
      <View style={[styles.mapCanvas, fullScreen && styles.fullScreenMapCanvas, styles.mapState]}>
        <Text style={styles.mapStateTitle}>Google Maps is not configured</Text>
        <Text style={styles.mapEmpty}>
          The Android Maps key was not included in this app configuration.
          Contact support before rebuilding the Rider app.
        </Text>
      </View>
    );
  }

  if (mapFailed) {
    return (
      <View style={[styles.mapCanvas, fullScreen && styles.fullScreenMapCanvas, styles.mapState]}>
        <Text style={styles.mapStateTitle}>Map unavailable</Text>
        <Text style={styles.mapEmpty}>
          Google Maps did not finish loading. Check your connection and Maps
          key configuration, then retry.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.retryButton}
          onPress={retryMap}
        >
          <Text style={styles.retryText}>Retry map</Text>
        </Pressable>
      </View>
    );
  }

  return (
      <View style={[styles.mapCanvas, fullScreen && styles.fullScreenMapCanvas]}>
      <MapView
        key={retryKey}
        style={styles.map}
        initialRegion={initialRegion}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={MAP_STYLE}
        onMapLoaded={() => setMapLoaded(true)}
        onRegionChangeComplete={onRegionChangeComplete}
        showsCompass
        toolbarEnabled={false}
      >
        {pickups.map((pickup, index) => {
          const selected = selectedPickupId === pickup.id;
          return (
            <Marker
              key={pickup.id}
              coordinate={pickup.pickupLocation}
              title={`Pickup request ${index + 1}`}
              description={pickup.pickupAddress}
              anchor={{x: 0.5, y: 0.5}}
              onPress={() => onSelectPickup(pickup.id)}
            >
              <View
                style={[
                  styles.mapMarker,
                  selected && styles.mapMarkerSelected,
                ]}
              >
                <Text style={styles.mapMarkerText}>{index + 1}</Text>
              </View>
            </Marker>
          );
        })}
        {riderLocation ? (
          <>
            <Circle
              center={riderLocation}
              radius={riderLocation.accuracyMeters}
              fillColor="rgba(33,138,82,0.12)"
              strokeColor="rgba(33,138,82,0.45)"
              strokeWidth={1}
            />
            <Marker
              coordinate={riderLocation}
              title="Your location"
              description={`Accuracy about ${Math.round(riderLocation.accuracyMeters * 10) / 10} m`}
              anchor={{x: 0.5, y: 0.5}}
            >
              <View style={styles.riderMarkerHalo}>
                <View style={styles.riderMarker}>
                  <View style={styles.riderMarkerCore} />
                </View>
              </View>
            </Marker>
          </>
        ) : null}
      </MapView>
      {!mapLoaded ? (
        <View style={styles.mapLoadingOverlay} pointerEvents="none">
          <ActivityIndicator color="#176744" />
          <Text style={styles.mapEmpty}>Loading Google Map...</Text>
        </View>
      ) : null}
    </View>
  );
}

function ExpandedPickupMap({
  pickups,
  selectedPickup,
  selectedPickupId,
  riderLocation,
  selectedDistance,
  previewPhotosPickupId,
  previewPhotos,
  previewPhotosLoading,
  previewPhotosError,
  acceptingPickupId,
  refreshingPickups,
  refreshError,
  mapRegion,
  onSelectPickup,
  onMapRegionChange,
  onReloadPickups,
  onClose,
  onAccept,
  onOpenGallery,
}: {
  pickups: MappedPickup[];
  selectedPickup: Pickup | null;
  selectedPickupId: string | null;
  riderLocation: RiderMapPosition | null;
  selectedDistance: number | null;
  previewPhotosPickupId: string | null;
  previewPhotos: PickupTrashPhotoUrl[];
  previewPhotosLoading: boolean;
  previewPhotosError: string;
  acceptingPickupId: string | null;
  refreshingPickups: boolean;
  refreshError: string;
  mapRegion: Region | null;
  onSelectPickup: (pickupId: string) => void;
  onMapRegionChange: (region: Region) => void;
  onReloadPickups: () => void;
  onClose: () => void;
  onAccept: (pickupId: string) => void;
  onOpenGallery: (index?: number) => void;
}) {
  const {height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const collapsedHeight = Math.max(190, height * 0.25);
  const expandedHeight = Math.min(height * 0.78, height - 48);
  const collapsedOffset = expandedHeight - collapsedHeight;
  const [translateY] = useState(() => new Animated.Value(collapsedOffset));
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const sheetExpandedRef = useRef(false);
  const sheetAnimatingRef = useRef(false);

  useEffect(() => {
    translateY.setValue(sheetExpandedRef.current ? 0 : collapsedOffset);
  }, [collapsedOffset, translateY]);

  const snapSheet = useCallback((expand: boolean) => {
    if (sheetAnimatingRef.current) return;

    sheetExpandedRef.current = expand;
    setSheetExpanded(expand);
    sheetAnimatingRef.current = true;
    Animated.timing(translateY, {
      toValue: expand ? 0 : collapsedOffset,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) sheetAnimatingRef.current = false;
    });
  }, [collapsedOffset, translateY]);

  const sheetPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      !sheetAnimatingRef.current &&
      Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => {
      translateY.extractOffset();
    },
    onPanResponderMove: (_event, gesture) => {
      const currentOffset = sheetExpandedRef.current ? 0 : collapsedOffset;
      const clampedDy = Math.max(
        -currentOffset,
        Math.min(collapsedOffset - currentOffset, gesture.dy),
      );
      translateY.setValue(clampedDy);
    },
    onPanResponderRelease: (_event, gesture) => {
      translateY.flattenOffset();
      const currentOffset = sheetExpandedRef.current ? 0 : collapsedOffset;
      const projectedOffset = currentOffset + gesture.dy;
      const shouldExpand = gesture.vy < -0.35 ||
        (gesture.vy > 0.35
          ? false
          : gesture.dy < -36 ||
            (Math.abs(gesture.dy) <= 36 && projectedOffset < collapsedOffset / 2));
      snapSheet(shouldExpand);
    },
    onPanResponderTerminate: () => {
      translateY.flattenOffset();
      snapSheet(sheetExpandedRef.current);
    },
  }), [collapsedOffset, snapSheet, translateY]);
  const selectedIndex = Math.max(
    0,
    pickups.findIndex((pickup) => pickup.id === selectedPickup?.id),
  );

  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.expandedMapScreen}>
        <PickupLocationsMap
          pickups={pickups}
          selectedPickupId={selectedPickupId}
          riderLocation={riderLocation}
          onSelectPickup={onSelectPickup}
          initialRegion={mapRegion}
          onRegionChangeComplete={onMapRegionChange}
          fullScreen
        />
        {refreshError ? (
          <View style={styles.expandedMapRefreshError}>
            <Text style={styles.expandedMapRefreshErrorText}>
              {refreshError}
            </Text>
          </View>
        ) : null}
        <View
          pointerEvents="box-none"
          style={[
            styles.expandedMapHeader,
            {top: Math.max(insets.top, Platform.OS === 'android' ? 24 : 0) + 12},
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to available pickups"
            onPress={onClose}
            style={({pressed}) => [styles.expandedMapBackButton, pressed && styles.disabled]}
          >
            <RemixIcon name="arrow-left-line" size={23} color="#173D2C" accessible={false} />
          </Pressable>
        </View>
        <View
          pointerEvents="box-none"
          style={[
            styles.expandedMapReload,
            {top: Math.max(insets.top, Platform.OS === 'android' ? 24 : 0) + 12},
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reload available pickups"
            accessibilityState={{disabled: refreshingPickups}}
            disabled={refreshingPickups}
            onPress={onReloadPickups}
            style={({pressed}) => [
              styles.expandedMapBackButton,
              refreshingPickups && styles.disabled,
              pressed && !refreshingPickups && styles.pressed,
            ]}
          >
            {refreshingPickups ? (
              <ActivityIndicator size="small" color="#176744" />
            ) : (
              <RemixIcon
                name="refresh-line"
                size={22}
                color="#173D2C"
                accessible={false}
              />
            )}
          </Pressable>
        </View>
        {pickups.length > 1 ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.expandedMapPickupNavigation,
              {
                top: height - insets.bottom - expandedHeight - 52,
                transform: [{translateY}],
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous pickup"
              accessibilityState={{disabled: selectedIndex === 0}}
              disabled={selectedIndex === 0}
              onPress={() => onSelectPickup(pickups[selectedIndex - 1].id)}
              style={({pressed}) => [
                styles.expandedMapPickupArrow,
                selectedIndex === 0 && styles.disabled,
                pressed && selectedIndex > 0 && styles.pressed,
              ]}
            >
              <RemixIcon
                name="arrow-left-s-line"
                size={23}
                color="#173D2C"
                accessible={false}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next pickup"
              accessibilityState={{disabled: selectedIndex >= pickups.length - 1}}
              disabled={selectedIndex >= pickups.length - 1}
              onPress={() => onSelectPickup(pickups[selectedIndex + 1].id)}
              style={({pressed}) => [
                styles.expandedMapPickupArrow,
                selectedIndex >= pickups.length - 1 && styles.disabled,
                pressed && selectedIndex < pickups.length - 1 && styles.pressed,
              ]}
            >
              <RemixIcon
                name="arrow-right-s-line"
                size={23}
                color="#173D2C"
                accessible={false}
              />
            </Pressable>
          </Animated.View>
        ) : null}
        <Animated.View
          style={[
            styles.pickupBottomSheet,
            {
              height: expandedHeight,
              bottom: insets.bottom,
              transform: [{translateY}],
            },
          ]}
        >
          <View {...sheetPanResponder.panHandlers} style={styles.sheetHandleArea}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sheetExpanded ? 'Collapse pickup details' : 'Expand pickup details'}
              onPress={() => snapSheet(!sheetExpanded)}
              style={styles.sheetHandleButton}
            >
              <View style={styles.sheetHandle} />
            </Pressable>
          </View>
          {selectedPickup ? (
            <View style={styles.sheetAcceptAction}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Accept selected pickup"
                disabled={acceptingPickupId !== null}
                onPress={() => onAccept(selectedPickup.id)}
                style={({pressed}) => [
                  styles.sheetAcceptButton,
                  acceptingPickupId !== null && styles.disabled,
                  pressed && acceptingPickupId === null && styles.pressed,
                ]}
              >
                {acceptingPickupId === selectedPickup.id ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.sheetAcceptText}>Accept pickup</Text>
                )}
              </Pressable>
            </View>
          ) : null}
          {selectedPickup ? (
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={sheetExpanded}
            >
              <Text style={styles.sheetEyebrow}>SELECTED PICKUP</Text>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {selectedPickup.items?.length
                  ? selectedPickup.items.map((item) => item.wasteTypeName).join(', ')
                  : selectedPickup.wasteTypeName || 'Pickup request'}
              </Text>
              <Text style={styles.sheetPrimaryMeta}>
                {selectedPickup.scheduledDate || 'Date not set'} ·{' '}
                {selectedPickup.scheduledTime || 'Time not set'}
                {'  ·  '}{selectedPickup.estimatedWeight ?? 0} kg
              </Text>
              <Text style={styles.sheetDetailValue}>
                {selectedPickup.facilityName || 'Destination facility not set'}
                {selectedDistance !== null ? ` · ${selectedDistance.toFixed(1)} km away` : ''}
              </Text>
              <View style={styles.sheetTrashPhotos}>
                <Text style={styles.sheetDetailLabel}>Trash photos</Text>
                {previewPhotosPickupId !== selectedPickup.id || previewPhotosLoading ? (
                  <View style={styles.trashPhotoStatus}>
                    <ActivityIndicator size="small" color="#176744" />
                    <Text style={styles.previewMuted}>Loading photos…</Text>
                  </View>
                ) : previewPhotosError ? (
                  <Text style={styles.previewMuted}>{previewPhotosError}</Text>
                ) : previewPhotos.length === 0 ? (
                  <Text style={styles.previewMuted}>No photos attached.</Text>
                ) : (
                  <FlatList
                    horizontal
                    data={previewPhotos}
                    style={{height: 86}}
                    contentContainerStyle={styles.trashPhotoGallery}
                    showsHorizontalScrollIndicator={false}
                    initialNumToRender={2}
                    maxToRenderPerBatch={2}
                    windowSize={2}
                    keyExtractor={(photo) => photo.path}
                    renderItem={({item, index}) => (
                      <TrashPhotoThumbnail
                        photo={item}
                        index={index}
                        onPress={() => onOpenGallery(index)}
                      />
                    )}
                  />
                )}
              </View>
              {sheetExpanded ? (
                <>
                  <View style={styles.sheetDivider} />
                  <Text style={styles.sheetDetailLabel}>Pickup address</Text>
                  <Text style={styles.sheetDetailValue}>
                    {selectedPickup.pickupAddress.trim() || 'Address unavailable'}
                  </Text>
                  {selectedPickup.items?.map((item, index) => (
                    <Text key={`${item.wasteTypeId}:${item.bagSizeId}:${index}`} style={styles.sheetItemDetail}>
                      {item.wasteTypeName}: {item.quantity} × {item.bagSizeLabel}
                    </Text>
                  ))}
                </>
              ) : null}
            </ScrollView>
          ) : (
            <View style={styles.sheetEmpty}>
              <Text style={styles.sheetTitle}>No pickup selected</Text>
              <Text style={styles.sheetEmptyText}>
                Tap a pickup marker to view its request details.
              </Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function PickupListScreen({ mode }: { mode: PickupListMode }) {
  const { rider, loading: authLoading } = useAuth();
  const {
    latestLocation,
    locationMessage,
    waitForFreshLocation,
  } = useRiderLocation();
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [activePickups, setActivePickups] = useState<Pickup[]>([]);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [pickupMapRegion, setPickupMapRegion] = useState<Region | null>(null);
  const [riderLocation, setRiderLocation] =
    useState<RiderMapPosition | null>(null);
  const [riderLocationStatus, setRiderLocationStatus] = useState('');
  const [acceptingPickupId, setAcceptingPickupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [nextAvailableCursor, setNextAvailableCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mineStatusFilter, setMineStatusFilter] =
    useState<MyPickupStatusFilter>('all');
  const [historyStatusFilter, setHistoryStatusFilter] =
    useState<PickupHistoryStatusFilter>('all');
  const [hasMoreMinePickups, setHasMoreMinePickups] = useState(false);
  const [hasMoreHistoryPickups, setHasMoreHistoryPickups] = useState(false);
  const [historyRecordCount, setHistoryRecordCount] = useState<number | null>(null);
  const [activePickupCount, setActivePickupCount] = useState<number | null>(null);
  const [activePickupCountError, setActivePickupCountError] = useState('');
  const requestInFlight = useRef(false);
  const refreshQueued = useRef(false);
  const loadRef = useRef<(() => Promise<void>) | null>(null);
  const hasLoadedPickups = useRef(false);
  const loadedAvailablePages = useRef(0);
  const acceptanceInFlight = useRef(false);
  const screenFocused = useRef(false);
  const acceptedPickupIds = useRef(new Set<string>());
  const mineCursor = useRef<MyPickupsPageCursor | null>(null);
  const mineFilterVersion = useRef(0);
  const historyCursor = useRef<QueryDocumentSnapshot | null>(null);
  const historyFilterVersion = useRef(0);
  const photoRequestVersion = useRef(0);
  const [previewPhotosPickupId, setPreviewPhotosPickupId] =
    useState<string | null>(null);
  const [previewPhotos, setPreviewPhotos] = useState<
    PickupTrashPhotoUrl[]
  >([]);
  const [previewPhotosLoading, setPreviewPhotosLoading] = useState(false);
  const [previewPhotosError, setPreviewPhotosError] = useState('');
  const [galleryPhotoIndex, setGalleryPhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!latestLocation || getRiderMapLocationSampleIssue(latestLocation)) {
      setRiderLocation(null);
      setRiderLocationStatus(locationMessage);
      return;
    }
    const quality = getRiderMapLocationQuality(latestLocation);
    const accuracy = latestLocation.coords.accuracy;
    if (quality.issue || typeof accuracy !== 'number') {
      setRiderLocation(null);
      setRiderLocationStatus(quality.message);
      return;
    }
    setRiderLocation({
      latitude: latestLocation.coords.latitude,
      longitude: latestLocation.coords.longitude,
      accuracyMeters: accuracy,
      timestamp: latestLocation.timestamp,
    });
    setRiderLocationStatus(quality.message);
  }, [latestLocation, locationMessage]);

  const flushQueuedRefresh = useCallback(() => {
    if (
      refreshQueued.current &&
      screenFocused.current &&
      AppState.currentState === 'active' &&
      loadRef.current
    ) {
      refreshQueued.current = false;
      void loadRef.current();
    }
  }, []);

  const load = useCallback(async (clearAvailableOnFailure = false) => {
    if (requestInFlight.current) {
      if (screenFocused.current && AppState.currentState === 'active') {
        refreshQueued.current = true;
      }
      return;
    }
    if (!rider) {
      setPickups([]);
      setActivePickups([]);
      mineCursor.current = null;
      setHasMoreMinePickups(false);
      historyCursor.current = null;
      setHasMoreHistoryPickups(false);
      setHistoryRecordCount(null);
      setActivePickupCount(null);
      setActivePickupCountError('');
      setLoading(false);
      return;
    }
    const mineFilterVersionAtStart = mineFilterVersion.current;
    const historyFilterVersionAtStart = historyFilterVersion.current;
    const quietRefresh = hasLoadedPickups.current;
    requestInFlight.current = true;
    refreshQueued.current = false;
    setRefreshing(true);
    setRefreshError('');
    setActivePickupCountError('');
    if (!quietRefresh) {
      setLoading(true);
      setError('');
    }
    try {
      let result: Pickup[];
      if (mode === 'available') {
        const pageCount = Math.max(loadedAvailablePages.current, 1);
        let cursor: string | undefined;
        let pagesLoaded = 0;
        const availablePickups: Pickup[] = [];
        for (let pageNumber = 0; pageNumber < pageCount; pageNumber += 1) {
          const page = await getAvailablePickupsPage(cursor);
          availablePickups.push(...page.pickups);
          pagesLoaded += 1;
          cursor = page.nextCursor ?? undefined;
          if (!cursor) break;
        }
        const mine = await getMyPickups(rider.id);
        result = Array.from(
          new Map(availablePickups.map((pickup) => [pickup.id, pickup])).values(),
        ).filter(
          (pickup) => !acceptedPickupIds.current.has(pickup.id),
        );
        loadedAvailablePages.current = pagesLoaded;
        setNextAvailableCursor(cursor ?? null);
        setActivePickups(mine.filter((pickup) => pickup.status !== 'completed'));
        setSelectedPickupId((current) =>
          current && result.some((pickup) => pickup.id === current)
            ? current
            : result.find(hasCoordinates)?.id ?? result[0]?.id ?? null,
        );
      }
      else if (mode === 'mine') {
        const [pageResult, countResult] = await Promise.allSettled([
          getMyPickupsPage(rider.id, mineStatusFilter),
          getMyActivePickupCount(rider.id),
        ]);
        if (pageResult.status === 'rejected') throw pageResult.reason;
        if (mineFilterVersionAtStart !== mineFilterVersion.current) return;
        const page = pageResult.value;
        result = page.pickups;
        mineCursor.current = page.nextCursor;
        setHasMoreMinePickups(page.nextCursor !== null);
        if (countResult.status === 'fulfilled') {
          setActivePickupCount(countResult.value);
        } else {
          console.error('Failed to refresh active pickup count:', countResult.reason);
          setActivePickupCount(null);
          setActivePickupCountError('The active pickup count could not be refreshed.');
        }
      }
      else {
        const [page, count] = await Promise.all([
          getPickupHistoryPage(rider.id, historyStatusFilter),
          getPickupHistoryCount(rider.id, historyStatusFilter),
        ]);
        if (historyFilterVersionAtStart !== historyFilterVersion.current) return;
        result = page.pickups;
        historyCursor.current = page.nextCursor;
        setHasMoreHistoryPickups(page.nextCursor !== null);
        setHistoryRecordCount(count);
      }
      setPickups(result);
      hasLoadedPickups.current = true;
      setError('');
    } catch (err) {
      console.error('Failed to load pickup list:', err);
      if (clearAvailableOnFailure && mode === 'available') {
        loadedAvailablePages.current = 0;
        setPickups([]);
        setSelectedPickupId(null);
        setNextAvailableCursor(null);
      }
      if (hasLoadedPickups.current) {
        setRefreshError(
          getPickupLoadErrorMessage(err) +
            (clearAvailableOnFailure
              ? ' Available pickup markers were cleared until refresh succeeds.'
              : ' Showing the last loaded results.'),
        );
      } else {
        setError(getPickupLoadErrorMessage(err));
      }
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
      flushQueuedRefresh();
    }
  }, [flushQueuedRefresh, historyStatusFilter, mineStatusFilter, mode, rider]);

  const reloadExpandedAvailablePickups = useCallback(() => {
    if (mode !== 'available' || requestInFlight.current) return;
    void load(true);
  }, [load, mode]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  async function loadMoreAvailablePickups() {
    if (!rider || !nextAvailableCursor || requestInFlight.current) return;
    requestInFlight.current = true;
    setLoadingMore(true);
    setRefreshError('');
    try {
      const page = await getAvailablePickupsPage(nextAvailableCursor);
      const newPickups = page.pickups.filter(
        (pickup) => !acceptedPickupIds.current.has(pickup.id),
      );
      setPickups((current) => Array.from(
        new Map([...current, ...newPickups].map((pickup) => [pickup.id, pickup])).values(),
      ));
      loadedAvailablePages.current += 1;
      setNextAvailableCursor(page.nextCursor);
    } catch (err) {
      console.error('Failed to load more available pickups:', err);
      setRefreshError(getPickupLoadErrorMessage(err));
    } finally {
      requestInFlight.current = false;
      setLoadingMore(false);
      flushQueuedRefresh();
    }
  }

  function changeMineStatusFilter(statusFilter: MyPickupStatusFilter) {
    if (statusFilter === mineStatusFilter) return;
    mineFilterVersion.current += 1;
    mineCursor.current = null;
    setHasMoreMinePickups(false);
    setPickups([]);
    hasLoadedPickups.current = false;
    setLoading(true);
    setRefreshError('');
    setMineStatusFilter(statusFilter);
  }

  function changeHistoryStatusFilter(statusFilter: PickupHistoryStatusFilter) {
    if (statusFilter === historyStatusFilter) return;
    historyFilterVersion.current += 1;
    historyCursor.current = null;
    setHasMoreHistoryPickups(false);
    setHistoryRecordCount(null);
    setPickups([]);
    hasLoadedPickups.current = false;
    setLoading(true);
    setRefreshError('');
    setError('');
    setHistoryStatusFilter(statusFilter);
  }

  async function loadMoreMinePickups() {
    if (!rider || requestInFlight.current || !mineCursor.current) return;
    const cursor = mineCursor.current;
    const filterVersion = mineFilterVersion.current;
    requestInFlight.current = true;
    setLoadingMore(true);
    setRefreshError('');
    try {
      const page = await getMyPickupsPage(
        rider.id,
        mineStatusFilter,
        cursor,
      );
      if (filterVersion !== mineFilterVersion.current) return;
      mineCursor.current = page.nextCursor;
      setHasMoreMinePickups(page.nextCursor !== null);
      setPickups((current) => [...current, ...page.pickups]);
    } catch (err) {
      console.error('Failed to load more assigned pickups:', err);
      setRefreshError(getPickupLoadErrorMessage(err));
    } finally {
      requestInFlight.current = false;
      setLoadingMore(false);
      flushQueuedRefresh();
    }
  }

  async function loadMoreHistoryPickups() {
    if (!rider || requestInFlight.current || !historyCursor.current) return;
    const cursor = historyCursor.current;
    const filterVersion = historyFilterVersion.current;
    requestInFlight.current = true;
    setLoadingMore(true);
    setRefreshError('');
    try {
      const page = await getPickupHistoryPage(
        rider.id,
        historyStatusFilter,
        cursor,
      );
      if (filterVersion !== historyFilterVersion.current) return;
      historyCursor.current = page.nextCursor;
      setHasMoreHistoryPickups(page.nextCursor !== null);
      setPickups((current) => Array.from(
        new Map([...current, ...page.pickups].map((pickup) => [pickup.id, pickup])).values(),
      ));
    } catch (err) {
      console.error('Failed to load more pickup history:', err);
      setRefreshError(getPickupLoadErrorMessage(err));
    } finally {
      requestInFlight.current = false;
      setLoadingMore(false);
      flushQueuedRefresh();
    }
  }

  useFocusEffect(useCallback(() => {
    screenFocused.current = true;
    if (AppState.currentState === 'active') void load();
    if (mode !== 'available') {
      return () => {
        screenFocused.current = false;
      };
    }
    const timer = setInterval(() => {
      if (screenFocused.current && AppState.currentState === 'active') {
        void load();
      }
    }, 30_000);
    const appStateSubscription = AppState.addEventListener(
      'change',
      (state) => {
      if (
        screenFocused.current &&
        state === 'active'
      ) void load();
      },
    );

    return () => {
      screenFocused.current = false;
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [load, mode]));

  async function loadRiderLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission Required', 'Allow location access to calculate pickup distance.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const quality = getRiderMapLocationQuality(position);
      if (quality.issue) {
        Alert.alert('Location Unavailable', quality.message);
        return;
      }
      if (quality.accuracyMeters === null) {
        Alert.alert('Location Unavailable', quality.message);
        return;
      }
      setRiderLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: quality.accuracyMeters,
        timestamp: position.timestamp,
      });
      setRiderLocationStatus(quality.message);
    } catch (locationError) {
      console.error('Failed to load rider location for pickup map:', locationError);
      Alert.alert('Location Error', 'Unable to calculate pickup distance right now.');
    }
  }

  async function handleAcceptPickup(pickupId: string) {
    if (!rider || acceptanceInFlight.current) return;
    acceptanceInFlight.current = true;
    setAcceptingPickupId(pickupId);
    try {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (permission.status !== 'granted') {
          throw new Error(
            permission.canAskAgain
              ? 'Allow location access to accept a pickup.'
              : 'Enable location permission for BasuraGo Rider in device settings, then retry.',
          );
        }
        if (!(await Location.hasServicesEnabledAsync())) {
          throw new Error(
            'Turn on device location services, then retry pickup acceptance.',
          );
        }

        // This returns the context's current eligible sample immediately when
        // one exists, or waits for the next sample that meets the same rules.
        const acceptanceLocation = await waitForFreshLocation(
          RIDER_LOCATION_ACQUISITION_TIMEOUT_MS,
        );
        createRiderLocationPublishInput(acceptanceLocation);
      } catch (locationError) {
        const errorCode =
          typeof locationError === 'object' &&
          locationError !== null &&
          'code' in locationError &&
          typeof locationError.code === 'string'
            ? locationError.code
            : 'location-refresh-failed';
        console.warn('Could not refresh rider location before acceptance.', {
          errorCode,
          reason: locationError instanceof Error
            ? locationError.message
            : 'Unknown location error.',
        });
        Alert.alert(
          'Fresh GPS Location Required',
          locationError instanceof Error
            ? locationError.message
            : 'Turn on location services and wait for a fresh, accurate GPS fix.',
        );
        return;
      }

      try {
        await acceptPickup(pickupId);
      } catch (acceptError) {
        console.error('Failed to accept pickup from map preview:', acceptError);
        Alert.alert('Unable to Accept Pickup', acceptError instanceof Error ? acceptError.message : 'Please try again.');
        return;
      }

      acceptedPickupIds.current.add(pickupId);
      setPickups((current) => current.filter((pickup) => pickup.id !== pickupId));
      setSelectedPickupId((current) => current === pickupId ? null : current);
      try {
        router.push({
          pathname: '/pickup-details',
          params: {pickupId, from: '/available-pickups'},
        });
      } catch (navigationError) {
        console.error('Failed to open accepted pickup details:', navigationError);
        Alert.alert(
          'Pickup Accepted',
          'This pickup was accepted, but its details could not be opened. Find it in My Pickups.',
        );
      }
    } finally {
      acceptanceInFlight.current = false;
      setAcceptingPickupId(null);
    }
  }

  const copy = pageCopy[mode];
  const summaryCount = mode === 'mine'
    ? activePickupCount ?? '—'
    : mode === 'history'
      ? historyRecordCount ?? '—'
      : pickups.length;
  const mappedPickups = pickups.filter(hasCoordinates);
  const selectedPickup = pickups.find((pickup) => pickup.id === selectedPickupId) ?? pickups[0] ?? null;
  const selectedDistance =
    riderLocation && selectedPickup && hasCoordinates(selectedPickup)
      ? getDistanceKm(riderLocation, selectedPickup.pickupLocation)
      : null;
  const selectedPreviewPickupId = mode === 'available'
    ? selectedPickup?.id ?? null
    : null;

  useFocusEffect(useCallback(() => {
    if (!selectedPreviewPickupId) {
      setGalleryPhotoIndex(null);
      setPreviewPhotosPickupId(null);
      setPreviewPhotos([]);
      setPreviewPhotosLoading(false);
      setPreviewPhotosError('');
      return;
    }

    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const requestVersion = ++photoRequestVersion.current;
    setPreviewPhotosPickupId(selectedPreviewPickupId);
    setPreviewPhotos([]);
    setPreviewPhotosError('');

    const loadPhotos = async () => {
      setPreviewPhotosLoading(true);
      try {
        const photos = await getPickupTrashPhotoUrls(selectedPreviewPickupId);
        if (!active || requestVersion !== photoRequestVersion.current) return;
        setPreviewPhotosPickupId(selectedPreviewPickupId);
        setPreviewPhotos(photos);
        setPreviewPhotosError('');
        if (photos.length > 0) {
          refreshTimer = setTimeout(() => {
            void loadPhotos();
          }, 4 * 60 * 1000);
        }
      } catch (photoError) {
        if (!active || requestVersion !== photoRequestVersion.current) return;
        const code = typeof photoError === 'object' &&
            photoError !== null && 'code' in photoError &&
            typeof photoError.code === 'string'
          ? photoError.code.replace(/^functions\//, '')
          : '';
        setPreviewPhotos([]);
        setPreviewPhotosError(
          code === 'failed-precondition' || code === 'permission-denied' ||
            code === 'not-found'
            ? 'This pickup is no longer available for photo viewing.'
            : 'Trash photos could not be loaded. Try reopening this pickup preview.',
        );
      } finally {
        if (active && requestVersion === photoRequestVersion.current) {
          setPreviewPhotosLoading(false);
        }
      }
    };

    void loadPhotos();
    return () => {
      active = false;
      photoRequestVersion.current += 1;
      if (refreshTimer) clearTimeout(refreshTimer);
      setGalleryPhotoIndex(null);
      setPreviewPhotosPickupId(null);
      setPreviewPhotos([]);
      setPreviewPhotosLoading(false);
      setPreviewPhotosError('');
    };
  }, [selectedPreviewPickupId]));

  function selectPreviewPickup(pickupId: string | null) {
    setGalleryPhotoIndex(null);
    photoRequestVersion.current += 1;
    setPreviewPhotosPickupId(null);
    setPreviewPhotos([]);
    setPreviewPhotosLoading(false);
    setPreviewPhotosError('');
    setSelectedPickupId(pickupId);
  }

  function openTrashPhotoGallery(index = 0) {
    if (previewPhotos.length === 0) return;
    setGalleryPhotoIndex(Math.min(index, previewPhotos.length - 1));
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load()}
            tintColor="#176744"
            colors={['#176744']}
          />
        }
      >
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/dashboard')} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{copy.title}</Text>
          {mode === 'available' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh available pickups"
              disabled={refreshing}
              onPress={() => void load()}
              style={[styles.refreshButton, refreshing && styles.disabled]}
            >
              {refreshing
                ? <ActivityIndicator size="small" color="#176744" />
                : <RemixIcon name="refresh-line" size={20} color="#176744" accessible={false} />}
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
        {mode === 'mine' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusFilters}
          >
            {myPickupFilters.map((filter) => {
              const selected = mineStatusFilter === filter.value;
              return (
                <Pressable
                  key={filter.value}
                  accessibilityRole="button"
                  accessibilityState={{selected}}
                  onPress={() => changeMineStatusFilter(filter.value)}
                  style={[
                    styles.statusFilter,
                    selected && styles.statusFilterSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusFilterText,
                      selected && styles.statusFilterTextSelected,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        {mode === 'history' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusFilters}
          >
            {pickupHistoryFilters.map((filter) => {
              const selected = historyStatusFilter === filter.value;
              return (
                <Pressable
                  key={filter.value}
                  accessibilityRole="button"
                  accessibilityState={{selected}}
                  onPress={() => changeHistoryStatusFilter(filter.value)}
                  style={[
                    styles.statusFilter,
                    selected && styles.statusFilterSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusFilterText,
                      selected && styles.statusFilterTextSelected,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        {refreshError ? (
          <Text accessibilityRole="alert" style={styles.refreshError}>
            {refreshError} Showing the last loaded results.
          </Text>
        ) : null}

        <View style={styles.summaryCard}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryLabel}>{mode === 'available' ? 'READY TO ACCEPT' : mode === 'mine' ? 'YOUR ASSIGNED WORK' : historyStatusFilter === 'completed' ? 'COMPLETED COLLECTIONS' : historyStatusFilter === 'cancelled' ? 'CANCELLED PICKUPS' : 'PICKUP HISTORY'}</Text>
            <Text style={styles.summaryNumber}>{authLoading || loading ? '—' : summaryCount}</Text>
            <Text style={styles.summaryCaption}>{mode === 'available' ? 'requests shown' : mode === 'mine' ? 'active pickups' : 'pickup records'}</Text>
          </View>
        </View>
        {mode === 'mine' && activePickupCountError ? (
          <Text accessibilityRole="alert" style={styles.refreshError}>
            {activePickupCountError}
          </Text>
        ) : null}

        {!authLoading && !rider ? <View style={styles.notice}><Text style={styles.noticeText}>Your rider profile is not available. Please sign in again.</Text></View> : null}
        {(authLoading || loading) && <ActivityIndicator size="large" color="#176744" style={styles.loader} />}
        {!authLoading && !loading && error ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Unable to load pickups</Text><Text style={styles.emptyText}>{error}</Text><Pressable style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}
        {!authLoading && !loading && rider && !error && pickups.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyIcon}>{mode === 'available' ? '♻' : mode === 'mine' ? '▤' : '✓'}</Text><Text style={styles.emptyTitle}>{copy.emptyTitle}</Text><Text style={styles.emptyText}>{copy.emptyMessage}</Text></View> : null}

        {mode === 'available' && !authLoading && !loading && nextAvailableCursor ? (
          <Pressable
            accessibilityRole="button"
            disabled={refreshing || loadingMore}
            onPress={() => void loadMoreAvailablePickups()}
            style={[styles.loadMoreButton, (refreshing || loadingMore) && styles.disabled]}
          >
            {loadingMore
              ? <ActivityIndicator size="small" color="#176744" />
              : <Text style={styles.loadMoreText}>{pickups.length === 0 ? 'Search more pickups' : 'Load more pickups'}</Text>}
          </Pressable>
        ) : null}

        {mode === 'available' && !mapExpanded && !authLoading && !loading && !error && pickups.length > 0 ? (
        <View style={styles.mapSection}>
            <View style={styles.mapHeader}>
              <View style={styles.mapHeaderCopy}>
                <Text style={styles.mapTitle}>Pickup map</Text>
                <Text style={styles.mapSubtitle}>{mappedPickups.length} mapped requests</Text>
              </View>
              <View style={styles.mapHeaderActions}>
                <Pressable style={styles.locationButton} onPress={loadRiderLocation}>
                  <Text style={styles.locationButtonText}>Use my location</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Expand pickup map"
                  onPress={() => {
                    if (selectedPickup) setSelectedPickupId(selectedPickup.id);
                    setMapExpanded(true);
                  }}
                  style={({pressed}) => [
                    styles.mapExpandButton,
                    pressed && styles.disabled,
                  ]}
                >
                  <RemixIcon name="fullscreen-line" size={18} color="#176744" accessible={false} />
                </Pressable>
              </View>
            </View>
            <PickupLocationsMap
              pickups={mappedPickups}
              selectedPickupId={selectedPickupId}
              riderLocation={riderLocation}
              onSelectPickup={selectPreviewPickup}
              initialRegion={pickupMapRegion}
              onRegionChangeComplete={setPickupMapRegion}
            />
            <View style={styles.mapLegend}>
              <View style={styles.mapLegendItem}>
                <View style={styles.pickupLegendDot} />
                <Text style={styles.mapLegendText}>Pickup requests</Text>
              </View>
              {riderLocation ? (
                <View style={styles.mapLegendItem}>
                  <View style={styles.riderLegendDot} />
                  <Text style={styles.mapLegendText}>Your location</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.mapSubtitle} accessibilityLiveRegion="polite">
              {riderLocation
                ? riderLocationStatus
                : locationMessage || 'Waiting for a fresh location to show your position.'}
            </Text>
            {selectedPickup ? (
              <View style={styles.previewCard}>
                <View style={styles.previewTop}>
                  <Text style={styles.previewEyebrow}>SELECTED REQUEST</Text>
                  <Text style={styles.previewTitle}>{selectedPickup.items?.length ? selectedPickup.items.map((item) => `${item.wasteTypeName} (${item.quantity})`).join(', ') : selectedPickup.wasteTypeName || 'Waste type not specified'}</Text>
                  <View style={styles.previewWeightRow}>
                    <Text style={styles.previewWeight}>{selectedPickup.estimatedWeight ?? 0} kg</Text>
                  </View>
                </View>
                <Text style={styles.previewMeta}>{selectedPickup.scheduledDate || 'Date not set'} · {selectedPickup.scheduledTime || 'Time not set'}</Text>
                <Text style={styles.previewMeta}>{selectedPickup.facilityName || 'Destination facility not set'}</Text>
                {selectedDistance !== null ? (
                  <Text style={styles.previewDistance}>{selectedDistance.toFixed(1)} km away</Text>
                ) : (
                  <Text style={styles.previewMuted}>Distance appears after your location and pickup coordinates are available.</Text>
                )}
                <View style={styles.trashPhotoPreview}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open trash photo gallery"
                    accessibilityState={{disabled: previewPhotos.length === 0}}
                    disabled={previewPhotos.length === 0}
                    onPress={() => openTrashPhotoGallery()}
                  >
                    <Text style={styles.trashPhotoTitle}>Trash photos</Text>
                  </Pressable>
                  {previewPhotosPickupId !== selectedPickup.id || previewPhotosLoading ? (
                    <View style={styles.trashPhotoStatus}>
                      <ActivityIndicator size="small" color="#176744" />
                      <Text style={styles.previewMuted}>Loading photos…</Text>
                    </View>
                  ) : previewPhotosError ? (
                    <Text style={styles.previewMuted}>{previewPhotosError}</Text>
                  ) : previewPhotos.length === 0 ? (
                    <Text style={styles.previewMuted}>No photos attached.</Text>
                  ) : (
                    <FlatList
                      horizontal
                      data={previewPhotos}
                      style={{height: 86}}
                      contentContainerStyle={styles.trashPhotoGallery}
                      showsHorizontalScrollIndicator={false}
                      initialNumToRender={2}
                      maxToRenderPerBatch={2}
                      windowSize={2}
                      keyExtractor={(photo) => photo.path}
                      renderItem={({item, index}) => (
                        <TrashPhotoThumbnail
                          photo={item}
                          index={index}
                          onPress={() => openTrashPhotoGallery(index)}
                        />
                      )}
                    />
                  )}
                </View>
                <Pressable
                  style={[styles.previewAcceptButton, acceptingPickupId === selectedPickup.id && styles.disabled]}
                  onPress={() => void handleAcceptPickup(selectedPickup.id)}
                  disabled={acceptingPickupId !== null}
                >
                  {acceptingPickupId === selectedPickup.id ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.previewAcceptText}>Accept pickup</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {!authLoading && !loading && !error && pickups.map((pickup) => {
          if (mode === 'available') return (
            <PickupCard
              key={pickup.id}
              pickup={pickup}
              accepting={acceptingPickupId !== null}
              onAccept={(pickupId) => void handleAcceptPickup(pickupId)}
            />
          );
          if (mode === 'mine') return <MyPickupCard key={pickup.id} pickup={pickup} returnTo="/my-pickups" onStarted={() => void load()} />;
          return <PickupHistoryCard key={pickup.id} pickup={pickup} />;
        })}
        {mode === 'mine' && hasMoreMinePickups ? (
          <Pressable
            accessibilityRole="button"
            disabled={loadingMore}
            onPress={() => void loadMoreMinePickups()}
            style={[styles.viewMoreButton, loadingMore && styles.disabled]}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color="#176744" />
            ) : (
              <Text style={styles.viewMoreText}>View more</Text>
            )}
          </Pressable>
        ) : null}
        {mode === 'history' && hasMoreHistoryPickups ? (
          <Pressable
            accessibilityRole="button"
            disabled={loadingMore}
            onPress={() => void loadMoreHistoryPickups()}
            style={[styles.viewMoreButton, loadingMore && styles.disabled]}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color="#176744" />
            ) : (
              <Text style={styles.viewMoreText}>View more</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
      <BottomNav />
      {mode === 'available' && mapExpanded ? (
        <ExpandedPickupMap
          pickups={mappedPickups}
          selectedPickup={selectedPickup}
          selectedPickupId={selectedPickupId}
          riderLocation={riderLocation}
          selectedDistance={selectedDistance}
          previewPhotosPickupId={previewPhotosPickupId}
          previewPhotos={previewPhotos}
          previewPhotosLoading={previewPhotosLoading}
          previewPhotosError={previewPhotosError}
          acceptingPickupId={acceptingPickupId}
          refreshingPickups={refreshing || loadingMore || loading}
          refreshError={refreshError}
          mapRegion={pickupMapRegion}
          onSelectPickup={selectPreviewPickup}
          onMapRegionChange={setPickupMapRegion}
          onReloadPickups={reloadExpandedAvailablePickups}
          onClose={() => setMapExpanded(false)}
          onAccept={(pickupId) => void handleAcceptPickup(pickupId)}
          onOpenGallery={openTrashPhotoGallery}
        />
      ) : null}
      <TrashPhotoGalleryModal
        visible={galleryPhotoIndex !== null}
        photos={previewPhotos}
        index={galleryPhotoIndex ?? 0}
        onClose={() => setGalleryPhotoIndex(null)}
        onIndexChange={setGalleryPhotoIndex}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F6' },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 145 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  backButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8DE' },
  backText: { color: '#176744', fontSize: 30, lineHeight: 32, marginTop: -3 },
  brandMark: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#E8F5EC', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#176744', fontSize: 23, fontWeight: '900' },
  brandCopy: { flex: 1 },
  brand: { color: '#176744', fontSize: 19, fontWeight: '900' },
  eyebrow: { marginTop: 3, color: '#8B9690', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#173D2C', fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  statusFilters: { flexDirection: 'row', gap: 8, paddingBottom: 16 },
  statusFilter: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: '#DCE8DE', backgroundColor: '#FFFFFF' },
  statusFilterSelected: { borderColor: '#176744', backgroundColor: '#176744' },
  statusFilterText: { color: '#526158', fontSize: 11, fontWeight: '700' },
  statusFilterTextSelected: { color: '#FFFFFF' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  refreshButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8DE' },
  refreshError: { marginTop: -12, marginBottom: 14, color: '#A23B32', fontSize: 12, lineHeight: 18 },
  subtitle: { marginTop: 7, marginBottom: 20, color: '#64736A', fontSize: 13, lineHeight: 19 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, marginBottom: 22, borderRadius: 20, backgroundColor: '#176744' },
  summaryIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#E8F5EC', alignItems: 'center', justifyContent: 'center' },
  summaryIconText: { color: '#176744', fontSize: 26, fontWeight: '900' },
  summaryCopy: { flex: 1 },
  summaryLabel: { color: '#BDE3C9', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  summaryNumber: { marginTop: 4, color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  summaryCaption: { color: '#D3E9DA', fontSize: 11 },
  loader: { marginVertical: 24 },
  notice: { padding: 14, borderRadius: 12, backgroundColor: '#FFF1CC' },
  noticeText: { color: '#A56500', fontSize: 12, lineHeight: 18 },
  emptyCard: { paddingHorizontal: 22, paddingVertical: 28, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#E6EDE7', borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
  emptyIcon: { color: '#176744', fontSize: 30, fontWeight: '700' },
  emptyTitle: { marginTop: 9, color: '#173D2C', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyText: { maxWidth: 280, marginTop: 6, color: '#64736A', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, backgroundColor: '#176744' },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  loadMoreButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 16, paddingHorizontal: 18, borderRadius: 13, borderWidth: 1, borderColor: '#DCE8DE', backgroundColor: '#FFFFFF' },
  loadMoreText: { color: '#176744', fontSize: 12, fontWeight: '800' },
  viewMoreButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 16, borderRadius: 13, borderWidth: 1, borderColor: '#DCE8DE', backgroundColor: '#FFFFFF' },
  viewMoreText: { color: '#176744', fontSize: 12, fontWeight: '800' },
  mapSection: { marginBottom: 18, padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8DE' },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  mapHeaderCopy: { flexShrink: 1 },
  mapHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mapTitle: { color: '#173D2C', fontSize: 16, fontWeight: '800' },
  mapSubtitle: { marginTop: 3, color: '#64736A', fontSize: 11 },
  locationButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#E8F5EC' },
  locationButtonText: { color: '#176744', fontSize: 11, fontWeight: '800' },
  mapCanvas: { width: '100%', height: 260, overflow: 'hidden', borderRadius: 22, backgroundColor: '#E9EDEA', borderWidth: 1, borderColor: '#DDE5DF' },
  fullScreenMapCanvas: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%', borderRadius: 0, borderWidth: 0 },
  map: { width: '100%', height: '100%' },
  mapExpandButton: { width: 33, height: 33, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#DCE8DE', elevation: 3 },
  expandedMapScreen: { flex: 1, backgroundColor: '#E9EDEA' },
  expandedMapHeader: { position: 'absolute', left: 14, zIndex: 20, elevation: 20 },
  expandedMapReload: { position: 'absolute', right: 14, zIndex: 20, elevation: 20 },
  expandedMapRefreshError: { position: 'absolute', top: 106, left: 14, right: 14, zIndex: 15, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: '#FFF1CC', elevation: 3 },
  expandedMapRefreshErrorText: { color: '#8A5600', fontSize: 12, lineHeight: 17 },
  expandedMapPickupNavigation: { position: 'absolute', left: 10, right: 10, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between' },
  expandedMapPickupArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#DCE8DE', elevation: 4 },
  expandedMapBackButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: '#DCE8DE', elevation: 4 },
  pickupBottomSheet: { position: 'absolute', right: 0, bottom: 0, left: 0, zIndex: 10, overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFFFFF', elevation: 16, shadowColor: '#102A1E', shadowOffset: {width: 0, height: -5}, shadowOpacity: 0.16, shadowRadius: 12 },
  sheetHandleArea: { minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  sheetHandleButton: { width: '100%', minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#C7D2CA' },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 22 },
  sheetEyebrow: { color: '#849087', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  sheetTitle: { marginTop: 5, color: '#173D2C', fontSize: 18, fontWeight: '800' },
  sheetPrimaryMeta: { marginTop: 8, color: '#526158', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  sheetDivider: { height: 1, marginVertical: 14, backgroundColor: '#E8EEE9' },
  sheetDetailLabel: { marginTop: 10, color: '#849087', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  sheetDetailValue: { marginTop: 4, color: '#34463B', fontSize: 14, lineHeight: 20 },
  sheetTrashPhotos: { marginTop: 2 },
  sheetItemDetail: { marginTop: 7, color: '#64736A', fontSize: 13, lineHeight: 18 },
  sheetAcceptAction: { paddingHorizontal: 20, paddingBottom: 8 },
  sheetAcceptButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#176744' },
  sheetAcceptText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  sheetEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  sheetEmptyText: { marginTop: 6, color: '#64736A', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  mapState: { alignItems: 'center', justifyContent: 'center', padding: 18 },
  mapStateTitle: { color: '#173D2C', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  mapLoadingOverlay: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.94)' },
  mapEmpty: { color: '#718076', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  mapMarker: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#C13D3D', borderWidth: 3, borderColor: '#FFFFFF', elevation: 4 },
  mapMarkerSelected: { backgroundColor: '#B7791F', transform: [{ scale: 1.12 }] },
  mapMarkerText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  riderMarkerHalo: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(33,138,82,0.20)' },
  riderMarker: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#218A52', borderWidth: 3, borderColor: '#FFFFFF', elevation: 5 },
  riderMarkerCore: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  mapLegend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 11 },
  mapLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pickupLegendDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#C13D3D' },
  riderLegendDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#218A52' },
  mapLegendText: { color: '#64736A', fontSize: 11, fontWeight: '600' },
  previewCard: { width: '100%', alignSelf: 'stretch', marginTop: 12, padding: 13, borderRadius: 14, backgroundColor: '#F5F8F6' },
  previewTop: { width: '100%', alignItems: 'stretch' },
  previewEyebrow: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  previewTitle: { width: '100%', marginTop: 4, color: '#173D2C', fontSize: 14, fontWeight: '800' },
  previewWeightRow: { width: '100%', alignItems: 'flex-end', marginTop: 6 },
  previewWeight: { maxWidth: '100%', color: '#176744', fontSize: 13, fontWeight: '900', flexShrink: 1, textAlign: 'right' },
  previewMeta: { marginTop: 6, color: '#64756A', fontSize: 11, lineHeight: 16 },
  previewDistance: { marginTop: 7, color: '#176744', fontSize: 12, fontWeight: '800' },
  previewMuted: { marginTop: 7, color: '#87948A', fontSize: 11, lineHeight: 16 },
  trashPhotoPreview: { marginTop: 12 },
  trashPhotoTitle: { color: '#26332B', fontSize: 13, fontWeight: '700', marginBottom: 7 },
  trashPhotoStatus: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 34 },
  trashPhotoGallery: { flexDirection: 'row', gap: 8 },
  trashPhotoThumbnail: { position: 'relative', overflow: 'hidden', backgroundColor: '#E7ECE8', borderRadius: 8, height: 86, width: 104 },
  trashPhotoImage: { height: '100%', width: '100%' },
  trashPhotoImageLoading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(231,236,232,0.72)' },
  trashPhotoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 5 },
  trashPhotoFallbackText: { color: '#64736A', fontSize: 9, textAlign: 'center' },
  galleryScreen: { flex: 1, backgroundColor: '#101310' },
  galleryHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8 },
  galleryCounter: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  galleryCloseButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)' },
  galleryList: { flex: 1 },
  gallerySlide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  galleryImage: { width: '100%', height: '100%' },
  galleryLoading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,19,16,0.25)' },
  galleryError: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
  galleryErrorText: { color: '#E2E8E3', fontSize: 14, textAlign: 'center' },
  previewAcceptButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 12, borderRadius: 14, backgroundColor: '#176744' },
  previewAcceptText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  activeSection: { marginTop: 4, marginBottom: 16 },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.78 },
});
