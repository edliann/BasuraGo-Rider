import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../../contexts/AuthContext/AuthContext';
import { getAvailablePickups, getMyPickups, getPickupHistory } from '../../services/firebase/pickups/pickup.services';
import type { Pickup } from '../../services/firebase/pickups/pickup.types';
import { acceptPickup } from '../../services/firebase/pickups/pickup-acceptance.services';
import PickupCard from './PickupCard';
import MyPickupCard from './MyPickupCard';
import PickupHistoryCard from './PickupHistoryCard';
import BottomNav from '../common/BottomNav';
import { SafeAreaView } from 'react-native-safe-area-context';

export type PickupListMode = 'available' | 'mine' | 'history';

type Coordinates = { latitude: number; longitude: number };

const pageCopy: Record<PickupListMode, { title: string; subtitle: string; emptyTitle: string; emptyMessage: string }> = {
  available: { title: 'Available Pickups', subtitle: 'Review new requests and accept the collections you can complete.', emptyTitle: 'No available pickups', emptyMessage: 'New collection requests will appear here when they are available.' },
  mine: { title: 'My Pickups', subtitle: 'Manage the collections assigned to you from acceptance to completion.', emptyTitle: 'No active pickups', emptyMessage: 'Pickups you accept will appear here until they are completed.' },
  history: { title: 'Pickup History', subtitle: 'Review your completed collections and recorded waste weights.', emptyTitle: 'No completed pickups yet', emptyMessage: 'Your completed collections will be saved here for reference.' },
};

function hasCoordinates(pickup: Pickup): pickup is Pickup & { pickupLocation: Coordinates } {
  return Boolean(
    pickup.pickupLocation &&
      Number.isFinite(pickup.pickupLocation.latitude) &&
      Number.isFinite(pickup.pickupLocation.longitude),
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

function getMarkerPosition(
  pickup: Pickup & { pickupLocation: Coordinates },
  pickups: (Pickup & { pickupLocation: Coordinates })[],
): { top: `${number}%`; left: `${number}%` } {
  const latitudes = pickups.map((item) => item.pickupLocation.latitude);
  const longitudes = pickups.map((item) => item.pickupLocation.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.005);
  const lonRange = Math.max(maxLon - minLon, 0.005);
  return {
    top: `${12 + ((maxLat - pickup.pickupLocation.latitude) / latRange) * 76}%` as `${number}%`,
    left: `${12 + ((pickup.pickupLocation.longitude - minLon) / lonRange) * 76}%` as `${number}%`,
  };
}

export default function PickupListScreen({ mode }: { mode: PickupListMode }) {
  const { rider, loading: authLoading } = useAuth();
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [activePickups, setActivePickups] = useState<Pickup[]>([]);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);
  const [riderLocation, setRiderLocation] = useState<Coordinates | null>(null);
  const [acceptingPickupId, setAcceptingPickupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!rider) {
      setPickups([]);
      setActivePickups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      let result: Pickup[];
      if (mode === 'available') {
        const [availablePickups, mine] = await Promise.all([
          getAvailablePickups(),
          getMyPickups(rider.id),
        ]);
        result = availablePickups;
        setActivePickups(mine.filter((pickup) => pickup.status !== 'completed'));
        setSelectedPickupId((current) =>
          current && availablePickups.some((pickup) => pickup.id === current)
            ? current
            : availablePickups.find(hasCoordinates)?.id ?? availablePickups[0]?.id ?? null,
        );
      }
      else if (mode === 'mine') result = (await getMyPickups(rider.id)).filter((pickup) => pickup.status !== 'completed');
      else result = await getPickupHistory(rider.id);
      setPickups(result);
    } catch (err) {
      console.error('Failed to load pickup list:', err);
      setError('We could not load this list. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [mode, rider]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

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
      setRiderLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (locationError) {
      console.error('Failed to load rider location for pickup map:', locationError);
      Alert.alert('Location Error', 'Unable to calculate pickup distance right now.');
    }
  }

  async function handleAcceptFromPreview(pickupId: string) {
    if (acceptingPickupId) return;
    setAcceptingPickupId(pickupId);
    try {
      await acceptPickup(pickupId);
      Alert.alert('Pickup Accepted', 'This pickup has been added to your assigned pickups.');
      await load();
    } catch (acceptError) {
      console.error('Failed to accept pickup from map preview:', acceptError);
      Alert.alert('Unable to Accept Pickup', acceptError instanceof Error ? acceptError.message : 'Please try again.');
    } finally {
      setAcceptingPickupId(null);
    }
  }

  const copy = pageCopy[mode];
  const mappedPickups = pickups.filter(hasCoordinates);
  const selectedPickup = pickups.find((pickup) => pickup.id === selectedPickupId) ?? pickups[0] ?? null;
  const selectedDistance =
    riderLocation && selectedPickup && hasCoordinates(selectedPickup)
      ? getDistanceKm(riderLocation, selectedPickup.pickupLocation)
      : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/dashboard')} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>B</Text></View>
          <View style={styles.brandCopy}><Text style={styles.brand}>BasuraGo</Text><Text style={styles.eyebrow}>RIDER WORKSPACE</Text></View>
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}><Text style={styles.summaryIconText}>{mode === 'available' ? '♻' : mode === 'mine' ? '▤' : '✓'}</Text></View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryLabel}>{mode === 'available' ? 'READY TO ACCEPT' : mode === 'mine' ? 'YOUR ASSIGNED WORK' : 'COMPLETED COLLECTIONS'}</Text>
            <Text style={styles.summaryNumber}>{authLoading || loading ? '—' : pickups.length}</Text>
            <Text style={styles.summaryCaption}>{mode === 'available' ? 'requests available now' : mode === 'mine' ? 'active pickups' : 'completed pickups'}</Text>
          </View>
        </View>

        {!authLoading && !rider ? <View style={styles.notice}><Text style={styles.noticeText}>Your rider profile is not available. Please sign in again.</Text></View> : null}
        {(authLoading || loading) && <ActivityIndicator size="large" color="#167647" style={styles.loader} />}
        {!authLoading && !loading && error ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Unable to load pickups</Text><Text style={styles.emptyText}>{error}</Text><Pressable style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}
        {!authLoading && !loading && !error && pickups.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyIcon}>{mode === 'available' ? '♻' : mode === 'mine' ? '▤' : '✓'}</Text><Text style={styles.emptyTitle}>{copy.emptyTitle}</Text><Text style={styles.emptyText}>{copy.emptyMessage}</Text></View> : null}

        {mode === 'available' && !authLoading && !loading && !error && pickups.length > 0 ? (
          <View style={styles.mapSection}>
            <View style={styles.mapHeader}>
              <View>
                <Text style={styles.mapTitle}>Pickup map</Text>
                <Text style={styles.mapSubtitle}>{mappedPickups.length} mapped requests</Text>
              </View>
              <Pressable style={styles.locationButton} onPress={loadRiderLocation}>
                <Text style={styles.locationButtonText}>Use my location</Text>
              </Pressable>
            </View>
            <View style={styles.mapCanvas}>
              {mappedPickups.length === 0 ? (
                <Text style={styles.mapEmpty}>No pickup coordinates available.</Text>
              ) : (
                mappedPickups.map((pickup) => {
                  const position = getMarkerPosition(pickup, mappedPickups);
                  const selected = selectedPickupId === pickup.id;
                  return (
                    <Pressable
                      key={pickup.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Preview pickup ${pickup.id}`}
                      onPress={() => setSelectedPickupId(pickup.id)}
                      style={[styles.mapMarker, position, selected && styles.mapMarkerSelected]}
                    >
                      <Text style={styles.mapMarkerText}>{pickup.estimatedWeight || '?'}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>
            {selectedPickup ? (
              <View style={styles.previewCard}>
                <View style={styles.previewTop}>
                  <View>
                    <Text style={styles.previewEyebrow}>SELECTED REQUEST</Text>
                    <Text style={styles.previewTitle}>{selectedPickup.wasteTypeName || 'Waste type not specified'}</Text>
                  </View>
                  <Text style={styles.previewWeight}>{selectedPickup.estimatedWeight ?? 0} kg</Text>
                </View>
                <Text style={styles.previewMeta}>{selectedPickup.scheduledDate || 'Date not set'} · {selectedPickup.scheduledTime || 'Time not set'}</Text>
                <Text style={styles.previewMeta}>{selectedPickup.facilityName || 'Destination facility not set'}</Text>
                {selectedDistance !== null ? (
                  <Text style={styles.previewDistance}>{selectedDistance.toFixed(1)} km away</Text>
                ) : (
                  <Text style={styles.previewMuted}>Distance appears after your location and pickup coordinates are available.</Text>
                )}
                <Pressable
                  style={[styles.previewAcceptButton, acceptingPickupId === selectedPickup.id && styles.disabled]}
                  onPress={() => handleAcceptFromPreview(selectedPickup.id)}
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

        {mode === 'available' && activePickups.length > 0 ? (
          <View style={styles.activeSection}>
            <Text style={styles.mapTitle}>Your active pickups</Text>
            {activePickups.map((pickup) => (
              <MyPickupCard key={pickup.id} pickup={pickup} riderId={rider?.id ?? ''} onStarted={() => void load()} />
            ))}
          </View>
        ) : null}

        {!authLoading && !loading && !error && pickups.map((pickup) => {
          if (mode === 'available') return <PickupCard key={pickup.id} pickup={pickup} onAccepted={() => void load()} />;
          if (mode === 'mine') return <MyPickupCard key={pickup.id} pickup={pickup} riderId={rider?.id ?? ''} onStarted={() => void load()} />;
          return <PickupHistoryCard key={pickup.id} pickup={pickup} />;
        })}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F5' },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 145 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  backButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8DE' },
  backText: { color: '#176744', fontSize: 30, lineHeight: 32, marginTop: -3 },
  brandMark: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#D7F5A6', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#105C3B', fontSize: 23, fontWeight: '900' },
  brandCopy: { flex: 1 },
  brand: { color: '#176744', fontSize: 19, fontWeight: '900' },
  eyebrow: { marginTop: 3, color: '#8B9690', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#1A2B20', fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { marginTop: 7, marginBottom: 20, color: '#718076', fontSize: 13, lineHeight: 19 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, marginBottom: 22, borderRadius: 20, backgroundColor: '#105C3B' },
  summaryIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#D7F5A6', alignItems: 'center', justifyContent: 'center' },
  summaryIconText: { color: '#105C3B', fontSize: 26, fontWeight: '900' },
  summaryCopy: { flex: 1 },
  summaryLabel: { color: '#BDE3C9', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  summaryNumber: { marginTop: 4, color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  summaryCaption: { color: '#D3E9DA', fontSize: 11 },
  loader: { marginVertical: 24 },
  notice: { padding: 14, borderRadius: 12, backgroundColor: '#FFF1CC' },
  noticeText: { color: '#8A5B10', fontSize: 12, lineHeight: 18 },
  emptyCard: { paddingHorizontal: 22, paddingVertical: 28, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#E6EDE7', borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
  emptyIcon: { color: '#167647', fontSize: 30, fontWeight: '700' },
  emptyTitle: { marginTop: 9, color: '#25352A', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyText: { maxWidth: 280, marginTop: 6, color: '#7A887E', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 11, backgroundColor: '#167647' },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  mapSection: { marginBottom: 18, padding: 15, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4ECE5' },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  mapTitle: { color: '#25352A', fontSize: 16, fontWeight: '800' },
  mapSubtitle: { marginTop: 3, color: '#7A887E', fontSize: 11 },
  locationButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#E8F5EC' },
  locationButtonText: { color: '#176B43', fontSize: 11, fontWeight: '800' },
  mapCanvas: { height: 220, overflow: 'hidden', borderRadius: 15, backgroundColor: '#EAF1EC', borderWidth: 1, borderColor: '#D7E4DA' },
  mapEmpty: { margin: 18, color: '#718076', fontSize: 12, lineHeight: 18 },
  mapMarker: { position: 'absolute', width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#167647', borderWidth: 3, borderColor: '#FFFFFF' },
  mapMarkerSelected: { backgroundColor: '#B7791F', transform: [{ scale: 1.12 }] },
  mapMarkerText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  previewCard: { marginTop: 12, padding: 13, borderRadius: 14, backgroundColor: '#F6F9F6' },
  previewTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  previewEyebrow: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  previewTitle: { marginTop: 4, color: '#25352A', fontSize: 14, fontWeight: '800' },
  previewWeight: { color: '#176B43', fontSize: 13, fontWeight: '900' },
  previewMeta: { marginTop: 6, color: '#64756A', fontSize: 11, lineHeight: 16 },
  previewDistance: { marginTop: 7, color: '#176B43', fontSize: 12, fontWeight: '800' },
  previewMuted: { marginTop: 7, color: '#87948A', fontSize: 11, lineHeight: 16 },
  previewAcceptButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 12, borderRadius: 12, backgroundColor: '#167647' },
  previewAcceptText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  activeSection: { marginTop: 4, marginBottom: 16 },
  disabled: { opacity: 0.65 },
});
