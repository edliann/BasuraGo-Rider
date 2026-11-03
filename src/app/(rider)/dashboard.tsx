import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAvailablePickups,
  getCompletedPickupCount,
  getMyActivePickupCount,
} from '../../services/firebase/pickups/pickup.services';
import { updateRiderOnlineStatus } from '../../services/firebase/riders/riders.services';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext/AuthContext';
import { auth } from '../../services/firebase/auth/auth.services';
import * as Location from 'expo-location';
import {useRiderLocation} from '../../contexts/RiderLocationContext/RiderLocationContext';
import {stopRiderBackgroundLocation} from
  '../../services/location/riderBackgroundLocationTask';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../components/common/BottomNav';
import RemixIcon from 'react-native-remix-icon';
import AvailablePickupsIcon from '../../../assets/images/available-pickups-icon.png';
import ActivePickupsIcon from '../../../assets/images/active-pickups-icon.png';
import PickupHistoryIcon from '../../../assets/images/history-icon.png';

export default function Dashboard() {
  const { rider, loading } = useAuth();
  const {
    isOnline: riderOnline,
    availabilityLoaded,
    locationTracking,
    locationMessage,
    checkLocationServices,
    setLocationMessage,
  } = useRiderLocation();

  const [pickupsCount, setPickupsCount] = useState(0);
  const [myPickupsCount, setMyPickupsCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [pickupsLoadedForRider, setPickupsLoadedForRider] =
    useState<typeof rider>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const pickupRequestInFlight = useRef(false);
  const refreshQueued = useRef(false);
  const refreshSequence = useRef(0);
  const dashboardActive = useRef(true);
  const loadPickupsRef = useRef<
    ((isRefresh?: boolean) => Promise<void>) | null
  >(null);
  const pickupsLoading = !rider || pickupsLoadedForRider !== rider;
  const isOnline = availabilityLoaded
    ? riderOnline
    : rider?.isOnline ?? false;
  const [onlineStatusLoading, setOnlineStatusLoading] = useState(false);
  const availabilityWriteVersion = useRef(0);
  const availabilityWriteQueue = useRef<Promise<void>>(Promise.resolve());

  const persistAvailability = useCallback((riderId: string, value: boolean) => {
    const version = ++availabilityWriteVersion.current;
    const write = availabilityWriteQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (
          version !== availabilityWriteVersion.current ||
          auth.currentUser?.uid !== riderId
        ) return false;
        await updateRiderOnlineStatus(riderId, value);
        return version === availabilityWriteVersion.current;
      });
    availabilityWriteQueue.current = write.then(() => undefined, () => undefined);
    return write;
  }, []);

  async function requestForegroundLocationPermission(): Promise<boolean> {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status === 'granted') return true;

    setLocationMessage('Location permission is needed to report your position while you are online.');
    const accepted = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Allow rider location',
        'BasuraGo shares your GPS position with dispatch while you are online. ' +
          'On Android, background access keeps sharing when you switch apps or lock your phone. ' +
          'Sharing stops when you go offline.',
        [
          {text: 'Not now', style: 'cancel', onPress: () => resolve(false)},
          {
            text: 'Continue',
            onPress: () => {
              void Location.requestForegroundPermissionsAsync().then((result) => {
                permission = result;
                resolve(result.status === 'granted');
              }).catch(() => resolve(false));
            },
          },
        ],
        {cancelable: false},
      );
    });

    if (!accepted) {
      setLocationMessage(permission.canAskAgain
        ? 'Location permission was denied. Allow it to share your location while online.'
        : 'Location permission is blocked. Enable it in Settings to share your location.');
      if (!permission.canAskAgain) {
        Alert.alert(
          'Enable location in Settings',
          'BasuraGo needs foreground location permission while you are online.',
          [
            {text: 'Later', style: 'cancel'},
            {text: 'Open Settings', onPress: () => void Linking.openSettings()},
          ],
        );
      }
    }
    return accepted;
  }

  async function requestBackgroundLocationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    let permission = await Location.getBackgroundPermissionsAsync();
    if (permission.status === 'granted') return true;

    const accepted = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Allow background location',
        'While you are online, BasuraGo Rider needs background location access ' +
          'to keep sharing your position with dispatch when you switch apps or ' +
          'lock your phone. Android may ask you to select “Allow all the time” ' +
          'or enable background access in Settings.',
        [
          {text: 'Not now', style: 'cancel', onPress: () => resolve(false)},
          {
            text: 'Continue',
            onPress: () => {
              void Location.requestBackgroundPermissionsAsync().then(
                (result) => {
                  permission = result;
                  resolve(result.status === 'granted');
                },
              ).catch((error: unknown) => {
                console.warn(
                  'Unable to request background location permission:',
                  error,
                );
                resolve(false);
              });
            },
          },
        ],
        {cancelable: false},
      );
    });

    if (!accepted) {
      setLocationMessage(
        permission.canAskAgain ?
          'Background location access was not granted. You can allow it the next time you go online.' :
          'Background location is blocked. Enable “Allow all the time” for BasuraGo Rider in Android Settings.',
      );
      if (!permission.canAskAgain) {
        Alert.alert(
          'Enable background location',
          'Open app permissions in Android Settings and allow location access all the time. Then return to BasuraGo Rider and go online.',
          [
            {text: 'Later', style: 'cancel'},
            {
              text: 'Open Settings',
              onPress: () => void Linking.openSettings(),
            },
          ],
        );
      }
    }
    return accepted;
  }

  async function handleOnlineStatusChange() {
    if (!rider) return;

    const nextStatus = !isOnline;
    try {
      setOnlineStatusLoading(true);
      if (nextStatus) {
        if (!(await requestForegroundLocationPermission())) return;
        if (!(await requestBackgroundLocationPermission())) return;
        if (!(await checkLocationServices())) return;
        await persistAvailability(rider.id, true);
        console.info('Rider availability set online.');
      } else {
        if (Platform.OS === 'android') {
          try {
            await stopRiderBackgroundLocation();
          } catch (error) {
            console.warn(
              'Unable to stop background location before going offline:',
              error,
            );
          }
        }
        await persistAvailability(rider.id, false);
        console.info('Rider manually went offline.');
        setLocationMessage('Location sharing is paused. Go online to resume reporting.');
      }
    } catch (error) {
      console.error('Failed to update rider online status:', error);
      Alert.alert('Unable to Update Status', 'Please check your connection and try again.');
    } finally {
      setOnlineStatusLoading(false);
    }
  }

  const loadPickups = useCallback(async (isRefresh = false) => {
    if (pickupRequestInFlight.current) {
      refreshQueued.current = true;
      return;
    }
    if (!rider) return;

    pickupRequestInFlight.current = true;
    const requestId = ++refreshSequence.current;
    if (isRefresh) {
      setRefreshing(true);
      setRefreshError('');
    }

    try {
      const [availableResult, activeCountResult, completedCountResult] =
        await Promise.allSettled([
        getAvailablePickups(),
        getMyActivePickupCount(rider.id),
        getCompletedPickupCount(rider.id),
      ]);
      if (availableResult.status === 'rejected') throw availableResult.reason;
      if (activeCountResult.status === 'rejected') throw activeCountResult.reason;
      if (completedCountResult.status === 'rejected') throw completedCountResult.reason;
      const availablePickups = availableResult.value;
      const activePickupCount = activeCountResult.value;
      const completedPickupCount = completedCountResult.value;
      if (
        !dashboardActive.current ||
        requestId !== refreshSequence.current ||
        auth.currentUser?.uid !== rider.id
      ) return;
      setPickupsCount(availablePickups.length);
      setMyPickupsCount(activePickupCount);
      setCompletedCount(completedPickupCount);
      setRefreshError('');
    } catch (error) {
      console.error('Failed to load dashboard pickup counts:', error);
      if (
        dashboardActive.current &&
        requestId === refreshSequence.current &&
        isRefresh
      ) {
        setRefreshError('Dashboard counts could not be refreshed. Showing the last loaded data.');
      }
    } finally {
      pickupRequestInFlight.current = false;
      if (
        dashboardActive.current &&
        requestId === refreshSequence.current
      ) {
        setPickupsLoadedForRider(rider);
        setRefreshing(false);
      }
      if (refreshQueued.current && dashboardActive.current) {
        refreshQueued.current = false;
        void loadPickupsRef.current?.(true);
      }
    }
  }, [rider]);

  useEffect(() => {
    dashboardActive.current = true;
    loadPickupsRef.current = loadPickups;
    return () => {
      dashboardActive.current = false;
      refreshQueued.current = false;
      refreshSequence.current += 1;
    };
  }, [loadPickups]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        return loadPickups(false);
      }
    });
    return () => {
      active = false;
    };
  }, [loadPickups]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#176744" />
        <Text style={styles.loadingText}>Getting your dashboard ready…</Text>
      </View>
    );
  }

  if (!rider) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Rider profile not available.</Text>
      </View>
    );
  }

    const firstName = rider.fullName?.trim().split(/\s+/)[0] || 'Rider';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadPickups(true)}
          tintColor="#176744"
          colors={['#176744']}
        />
      }
    >
      {refreshError ? (
        <Text accessibilityRole="alert" style={styles.refreshError}>
          {refreshError}
        </Text>
      ) : null}
      <View style={styles.hero}>
          <Image
            source={require('../../../assets/images/basurago-logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="BasuraGo logo"
          />
        <Text style={styles.role}>RIDER WORKSPACE</Text>
        <Text style={styles.greeting}>Good day, {firstName}!</Text>
        <Text style={styles.heroSubtitle}>Ready to make your next collection count?</Text>

        <View style={styles.statusPanel}>
          <View style={styles.statusCopy}>
            <View style={styles.statusHeadingRow}>
              <View style={[styles.statusDot, isOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
              <Text style={styles.statusEyebrow}>YOUR AVAILABILITY</Text>
            </View>
            <Text style={styles.statusTitle}>{isOnline ? 'You’re online' : 'You’re offline'}</Text>
            <Text style={styles.statusDescription}>
              {isOnline ? 'You can receive pickup requests.' : 'Go online when you’re ready to work.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: onlineStatusLoading }}
            style={[
              styles.statusButton,
              isOnline ? styles.statusButtonOnline : styles.statusButtonOffline,
              onlineStatusLoading && styles.buttonDisabled,
            ]}
            onPress={handleOnlineStatusChange}
            disabled={onlineStatusLoading}
          >
            {onlineStatusLoading ? (
              <ActivityIndicator color={isOnline ? '#176744' : '#FFFFFF'} size="small" />
            ) : (
              <Text style={[styles.statusButtonText, isOnline && styles.statusButtonTextOnline]}>
                {isOnline ? 'Go offline' : 'Go online'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardPrimary]}>
          <Text style={styles.statNumber}>{pickupsLoading ? '—' : pickupsCount}</Text>
          <Text style={styles.statLabel}>Available jobs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumberDark}>{pickupsLoading ? '—' : myPickupsCount}</Text>
          <Text style={styles.statLabelDark}>My active pickups</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumberDark}>{pickupsLoading ? '—' : completedCount}</Text>
          <Text style={styles.statLabelDark}>Completed</Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
        </View>
        <Text style={styles.sectionHint}>Your tools for today</Text>
        <View style={styles.locationAction}>
          <View style={styles.locationActionIcon}><RemixIcon name="map-pin-line" size={22} color="#176744" accessible={false} /></View>
          <View style={styles.locationActionCopy}>
            <Text style={styles.locationActionTitle}>{locationTracking ? 'Live location reporting' : 'Location reporting'}</Text>
            <Text
              style={styles.locationActionSubtitle}
              accessibilityLiveRegion="polite"
            >
              {locationMessage}
            </Text>
          </View>
          <View style={[styles.statusDot, locationTracking ? styles.statusDotOnline : styles.statusDotOffline]} />
        </View>
      </View>

      <View style={styles.servicesSection}>
        <View style={styles.serviceHeading}>
          <Text style={styles.sectionTitle}>Pickup Services</Text>
          <Text style={styles.sectionHint}>Choose a service to get started</Text>
        </View>
        <View style={styles.serviceGrid}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open available pickups" style={({ pressed }) => [styles.serviceCard, pressed && styles.servicePressed]} onPress={() => router.push('/available-pickups')}>
            <View style={styles.serviceIcon}><Image source={AvailablePickupsIcon} style={styles.serviceImage} accessible={false} importantForAccessibility="no" /></View>
            <Text style={styles.serviceTitle}>Available</Text>
            <Text style={styles.serviceSubtitle}>{pickupsLoading ? 'Loading…' : `${pickupsCount} requests`}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open my pickups" style={({ pressed }) => [styles.serviceCard, pressed && styles.servicePressed]} onPress={() => router.push('/my-pickups')}>
            <View style={styles.serviceIcon}><Image source={ActivePickupsIcon} style={styles.serviceImage} accessible={false} importantForAccessibility="no" /></View>
            <Text style={styles.serviceTitle}>My Pickups</Text>
            <Text style={styles.serviceSubtitle}>{pickupsLoading ? 'Loading…' : `${myPickupsCount} active`}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open pickup history" style={({ pressed }) => [styles.serviceCard, pressed && styles.servicePressed]} onPress={() => router.push('/pickup-history')}>
            <View style={styles.serviceIcon}><Image source={PickupHistoryIcon} style={styles.serviceImage} accessible={false} importantForAccessibility="no" /></View>
            <Text style={styles.serviceTitle}>History</Text>
            <Text style={styles.serviceSubtitle}>{pickupsLoading ? 'Loading…' : `${completedCount} completed`}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.footerText}>BasuraGo Rider · Collect responsibly</Text>
    </ScrollView>
    <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F6' },
  container: { flex: 1, backgroundColor: '#F5F8F6' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 150 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F5F8F6' },
  loadingText: { marginTop: 12, color: '#64756A', fontSize: 14 },
  errorText: { color: '#B42318', fontSize: 15, textAlign: 'center' },
  refreshError: { marginBottom: 12, color: '#A23B32', fontSize: 13, lineHeight: 18 },

  hero: { padding: 22, paddingTop: 20, borderRadius: 24, backgroundColor: '#176744', overflow: 'hidden' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center' },
  brandLogo: { width: 90, height: 38, flexShrink: 1 },
  role: { color: '#BDE3C9', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  signOutIcon: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, borderColor: '#4B896B', alignItems: 'center', justifyContent: 'center' },
  signOutIconText: { color: '#FFFFFF', fontSize: 22, fontWeight: '600' },
  greeting: { marginTop: 28, color: '#FFFFFF', fontSize: 27, fontWeight: '800', letterSpacing: -0.8 },
  heroSubtitle: { marginTop: 7, color: '#D3E9DA', fontSize: 13, lineHeight: 19 },
  statusPanel: { marginTop: 22, padding: 16, borderRadius: 19, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statusCopy: { flex: 1 },
  statusHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotOnline: { backgroundColor: '#16A34A' },
  statusDotOffline: { backgroundColor: '#98A2B3' },
  statusEyebrow: { color: '#6B7A70', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  statusTitle: { marginTop: 6, color: '#17251D', fontSize: 18, fontWeight: '800' },
  statusDescription: { marginTop: 4, color: '#68766D', fontSize: 11, lineHeight: 16 },
  statusButton: { minWidth: 94, paddingHorizontal: 13, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusButtonOnline: { backgroundColor: '#E7F5EC', borderWidth: 1, borderColor: '#B8E2C7' },
  statusButtonOffline: { backgroundColor: '#176744' },
  statusButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  statusButtonTextOnline: { color: '#176744' },
  buttonDisabled: { opacity: 0.65 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: { flex: 1, minWidth: 0, padding: 13, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7EDE8' },
  statCardPrimary: { backgroundColor: '#176744', borderColor: '#176744' },
  statIconWrap: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', marginBottom: 12 },
  statIconWrapSoft: { backgroundColor: '#E8F5EC' },
  statImage: { width: 19, height: 19, resizeMode: 'contain' },
  statNumber: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { marginTop: 4, color: '#D8F0E0', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  statNumberDark: { color: '#1D2C22', fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  statLabelDark: { marginTop: 4, color: '#718076', fontSize: 10, lineHeight: 14, fontWeight: '600' },

  quickActions: { marginTop: 27 },
  section: { marginTop: 28 },
  servicesSection: { marginTop: 27 },
  serviceHeading: { flexDirection: 'column', alignItems: 'flex-start', gap: 3 },
  serviceGrid: { flexDirection: 'row', gap: 10, marginTop: 14 },
  serviceCard: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 16, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4ECE5' },
  servicePressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  serviceIcon: { width: 49, height: 49, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5EC' },
  serviceImage: { width: 28, height: 28, resizeMode: 'contain' },
  serviceTitle: { marginTop: 11, color: '#25352A', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  serviceSubtitle: { marginTop: 5, color: '#7A887E', fontSize: 9, textAlign: 'center' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { color: '#1A2B20', fontSize: 20, fontWeight: '800', letterSpacing: -0.45 },
  sectionHint: { marginTop: 5, marginBottom: 13, color: '#7A887E', fontSize: 12, lineHeight: 17 },
  countPill: { minWidth: 27, height: 25, paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#E4F3E8', alignItems: 'center', justifyContent: 'center' },
  countPillText: { color: '#176744', fontSize: 12, fontWeight: '800' },
  locationAction: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 18, borderWidth: 1, borderColor: '#E4ECE5', backgroundColor: '#FFFFFF' },
  locationActionIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5EC' },
  locationActionCopy: { flex: 1, marginLeft: 12 },
  locationActionTitle: { color: '#25352A', fontSize: 14, fontWeight: '800' },
  locationActionSubtitle: { marginTop: 4, color: '#7A887E', fontSize: 11 },
  actionChevron: { marginLeft: 8, color: '#789080', fontSize: 26 },
  loader: { marginVertical: 20 },
  inlineError: { padding: 14, borderRadius: 12, color: '#B42318', backgroundColor: '#FEECEB', fontSize: 13 },
  emptyCard: { paddingHorizontal: 22, paddingVertical: 25, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#E6EDE7', borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
  emptyIcon: { color: '#176744', fontSize: 26, fontWeight: '700' },
  emptyTitle: { marginTop: 9, color: '#25352A', fontSize: 15, fontWeight: '800' },
  emptyText: { maxWidth: 270, marginTop: 5, color: '#7A887E', fontSize: 12, lineHeight: 18, textAlign: 'center' },

  profileCard: { flexDirection: 'row', alignItems: 'center', marginTop: 32, padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6EDE7' },
  profileInitial: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDF2E3' },
  profileInitialText: { color: '#176744', fontSize: 19, fontWeight: '800' },
  profileCopy: { flex: 1, marginLeft: 12 },
  profileName: { color: '#25352A', fontSize: 14, fontWeight: '800' },
  profileMeta: { marginTop: 3, color: '#7A887E', fontSize: 11 },
  profileStatus: { maxWidth: 88, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: '#E8F5EC' },
  profileStatusText: { color: '#176744', fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  logoutButton: { marginTop: 14, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E1E7E2', backgroundColor: '#FFFFFF' },
  logoutText: { color: '#68766D', fontSize: 13, fontWeight: '700' },
  footerText: { marginTop: 18, color: '#9AA69D', fontSize: 10, textAlign: 'center', letterSpacing: 0.4 },
});
