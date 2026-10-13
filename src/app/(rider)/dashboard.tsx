import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import {
  getAvailablePickups,
  getMyPickups,
  getPickupHistory,
} from '../../services/firebase/pickups/pickup.services';
import MyPickupCard from '../../components/pickups/MyPickupCard';
import PickupHistoryCard from '../../components/pickups/PickupHistoryCard';
import { updateRiderOnlineStatus } from '../../services/firebase/riders/riders.services';
import type { Pickup } from '../../services/firebase/pickups/pickup.types';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext/AuthContext';
import { logout } from '../../services/firebase/auth/auth.services';
import PickupCard from '../../components/pickups/PickupCard';
import * as Location from 'expo-location';
import { saveRiderLocation } from '../../services/firebase/riders/location.services';

export default function Dashboard() {
  const { rider, loading } = useAuth();

  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [myPickups, setMyPickups] = useState<Pickup[]>([]);
  const [pickupsLoading, setPickupsLoading] = useState(true);
  const [myPickupsLoading, setMyPickupsLoading] = useState(true);
  const [pickupError, setPickupError] = useState('');
  const [myPickupError, setMyPickupError] = useState('');
  const [pickupHistory, setPickupHistory] = useState<Pickup[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [isOnline, setIsOnline] = useState(rider?.isOnline ?? false);
  const [onlineStatusLoading, setOnlineStatusLoading] = useState(false);
  const [locationTracking, setLocationTracking] = useState(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    setIsOnline(rider?.isOnline ?? false);
  }, [rider]);

  async function handleOnlineStatusChange() {
    if (!rider) return;

    const nextStatus = !isOnline;
    try {
      setOnlineStatusLoading(true);
      await updateRiderOnlineStatus(rider.id, nextStatus);
      setIsOnline(nextStatus);

      if (nextStatus) {
        await startLocationTracking();
      } else {
        stopLocationTracking();
      }
    } catch (error) {
      console.error('Failed to update rider online status:', error);
      Alert.alert('Unable to Update Status', 'Please check your connection and try again.');
    } finally {
      setOnlineStatusLoading(false);
    }
  }

  async function loadPickups() {
    if (!rider) return;

    try {
      setPickupsLoading(true);
      setMyPickupsLoading(true);
      setHistoryLoading(true);
      setPickupError('');
      setMyPickupError('');
      setHistoryError('');

      const [availablePickups, assignedPickups, completedPickups] = await Promise.all([
        getAvailablePickups(),
        getMyPickups(rider.id),
        getPickupHistory(rider.id),
      ]);

      setPickups(availablePickups);
      setMyPickups(assignedPickups.filter((pickup) => pickup.status !== 'completed'));
      setPickupHistory(completedPickups);
    } catch (error) {
      console.error('Failed to load pickups:', error);
      setPickupError('Failed to load available pickups.');
      setMyPickupError('Failed to load assigned pickups.');
      setHistoryError('Failed to load pickup history.');
    } finally {
      setPickupsLoading(false);
      setMyPickupsLoading(false);
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (rider) loadPickups();
  }, [rider]);

  useEffect(() => {
    return () => {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, []);

  async function handleGetCurrentLocation() {
    if (!rider) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'BasuraGo needs your location to provide rider location services.',
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude, accuracy } = location.coords;

      await saveRiderLocation(rider.id, latitude, longitude, accuracy ?? null);
      Alert.alert('Location Updated', 'Your current location has been saved.');
    } catch (error) {
      console.error('Failed to save rider location:', error);
      Alert.alert('Location Error', 'Unable to save your current location.');
    }
  }

  async function startLocationTracking() {
    if (!rider) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'BasuraGo needs your location while you are online.',
        );
        return;
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 15000,
          distanceInterval: 25,
        },
        async (location) => {
          const { latitude, longitude, accuracy } = location.coords;
          try {
            await saveRiderLocation(rider.id, latitude, longitude, accuracy ?? null);
          } catch (error) {
            console.error('Failed to save rider location:', error);
          }
        },
      );

      locationSubscription.current?.remove();
      locationSubscription.current = subscription;
      setLocationTracking(true);
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      setLocationTracking(false);
      Alert.alert('Location Error', 'Unable to start location tracking.');
    }
  }

  function stopLocationTracking() {
    locationSubscription.current?.remove();
    locationSubscription.current = null;
    setLocationTracking(false);
  }

  async function handleLogout() {
    try {
      stopLocationTracking();
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
      Alert.alert('Sign Out Failed', 'Please try again.');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#167647" />
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

  const activeCount = myPickups.length;
  const completedCount = pickupHistory.length;
  const firstName = rider.fullName?.trim().split(/\s+/)[0] || 'Rider';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>B</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.logo}>BasuraGo</Text>
            <Text style={styles.role}>RIDER WORKSPACE</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={styles.signOutIcon}
            onPress={handleLogout}
          >
            <Text style={styles.signOutIconText}>↗</Text>
          </Pressable>
        </View>

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
              <ActivityIndicator color={isOnline ? '#176B43' : '#FFFFFF'} size="small" />
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
          <View style={styles.statIconWrap}><Text style={styles.statIcon}>↗</Text></View>
          <Text style={styles.statNumber}>{pickupsLoading ? '—' : pickups.length}</Text>
          <Text style={styles.statLabel}>Available jobs</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, styles.statIconWrapSoft]}><Text style={styles.statIconSoft}>▣</Text></View>
          <Text style={styles.statNumberDark}>{myPickupsLoading ? '—' : activeCount}</Text>
          <Text style={styles.statLabelDark}>My active pickups</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, styles.statIconWrapSoft]}><Text style={styles.statIconSoft}>✓</Text></View>
          <Text style={styles.statNumberDark}>{historyLoading ? '—' : completedCount}</Text>
          <Text style={styles.statLabelDark}>Completed</Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <Text style={styles.sectionHint}>Your tools for today</Text>
        </View>
        <Pressable style={styles.locationAction} onPress={handleGetCurrentLocation}>
          <View style={styles.locationActionIcon}><Text style={styles.locationActionIconText}>⌖</Text></View>
          <View style={styles.locationActionCopy}>
            <Text style={styles.locationActionTitle}>Update my location</Text>
            <Text style={styles.locationActionSubtitle}>
              {locationTracking ? 'Live location tracking is active' : 'Share your latest GPS position'}
            </Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Available pickups</Text>
          <View style={styles.countPill}><Text style={styles.countPillText}>{pickupsLoading ? '…' : pickups.length}</Text></View>
        </View>
        <Text style={styles.sectionHint}>Requests waiting for a rider</Text>

        {pickupsLoading && <ActivityIndicator color="#167647" style={styles.loader} />}
        {!pickupsLoading && pickupError !== '' && <Text style={styles.inlineError}>{pickupError}</Text>}
        {!pickupsLoading && pickupError === '' && pickups.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>♻</Text>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyText}>There are no available pickups right now. Check back soon.</Text>
          </View>
        )}
        {pickups.map((pickup) => (
          <PickupCard key={pickup.id} pickup={pickup} onAccepted={loadPickups} />
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>My pickups</Text>
          <View style={styles.countPill}><Text style={styles.countPillText}>{myPickupsLoading ? '…' : activeCount}</Text></View>
        </View>
        <Text style={styles.sectionHint}>Track the collections assigned to you</Text>

        {myPickupsLoading && <ActivityIndicator color="#167647" style={styles.loader} />}
        {!myPickupsLoading && myPickupError !== '' && <Text style={styles.inlineError}>{myPickupError}</Text>}
        {!myPickupsLoading && myPickupError === '' && myPickups.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>▣</Text>
            <Text style={styles.emptyTitle}>No active pickups</Text>
            <Text style={styles.emptyText}>Accepted and in-progress collections will appear here.</Text>
          </View>
        )}
        {!myPickupsLoading && myPickupError === '' && myPickups.map((pickup) => (
          <MyPickupCard key={pickup.id} pickup={pickup} riderId={rider.id} onStarted={loadPickups} />
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Pickup history</Text>
          <View style={styles.countPill}><Text style={styles.countPillText}>{historyLoading ? '…' : completedCount}</Text></View>
        </View>
        <Text style={styles.sectionHint}>Your recently completed collections</Text>

        {historyLoading && <ActivityIndicator color="#167647" style={styles.loader} />}
        {!historyLoading && historyError !== '' && <Text style={styles.inlineError}>{historyError}</Text>}
        {!historyLoading && historyError === '' && pickupHistory.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>Your history starts here</Text>
            <Text style={styles.emptyText}>Completed pickups will be saved here for easy reference.</Text>
          </View>
        )}
        {!historyLoading && historyError === '' && pickupHistory.map((pickup) => (
          <PickupHistoryCard key={pickup.id} pickup={pickup} />
        ))}
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileInitial}><Text style={styles.profileInitialText}>{firstName.charAt(0).toUpperCase()}</Text></View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{rider.fullName}</Text>
          <Text style={styles.profileMeta}>{rider.phoneNumber || 'No phone number added'}</Text>
          <Text style={styles.profileMeta}>Vehicle: {rider.vehicleId || 'Not assigned'}</Text>
        </View>
        <View style={styles.profileStatus}><Text style={styles.profileStatusText}>{rider.status}</Text></View>
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign out of BasuraGo</Text>
      </Pressable>
      <Text style={styles.footerText}>BasuraGo Rider · Collect responsibly</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8F5' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F5F8F5' },
  loadingText: { marginTop: 12, color: '#64756A', fontSize: 14 },
  errorText: { color: '#B42318', fontSize: 15, textAlign: 'center' },

  hero: { padding: 22, paddingTop: 20, borderRadius: 26, backgroundColor: '#105C3B', overflow: 'hidden' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#D7F5A6', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#105C3B', fontSize: 25, fontWeight: '900' },
  brandCopy: { marginLeft: 11, flex: 1 },
  logo: { color: '#FFFFFF', fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  role: { marginTop: 3, color: '#BDE3C9', fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
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
  statusButtonOffline: { backgroundColor: '#167647' },
  statusButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  statusButtonTextOnline: { color: '#176B43' },
  buttonDisabled: { opacity: 0.65 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: { flex: 1, minWidth: 0, padding: 13, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7EDE8' },
  statCardPrimary: { backgroundColor: '#167647', borderColor: '#167647' },
  statIconWrap: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', marginBottom: 12 },
  statIcon: { color: '#167647', fontSize: 18, fontWeight: '800' },
  statIconWrapSoft: { backgroundColor: '#E8F5EC' },
  statIconSoft: { color: '#167647', fontSize: 16, fontWeight: '800' },
  statNumber: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { marginTop: 4, color: '#D8F0E0', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  statNumberDark: { color: '#1D2C22', fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  statLabelDark: { marginTop: 4, color: '#718076', fontSize: 10, lineHeight: 14, fontWeight: '600' },

  quickActions: { marginTop: 27 },
  section: { marginTop: 28 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { color: '#1A2B20', fontSize: 20, fontWeight: '800', letterSpacing: -0.45 },
  sectionHint: { marginTop: 5, marginBottom: 13, color: '#7A887E', fontSize: 12, lineHeight: 17 },
  countPill: { minWidth: 27, height: 25, paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#E4F3E8', alignItems: 'center', justifyContent: 'center' },
  countPillText: { color: '#176B43', fontSize: 12, fontWeight: '800' },
  locationAction: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 18, borderWidth: 1, borderColor: '#E4ECE5', backgroundColor: '#FFFFFF' },
  locationActionIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5EC' },
  locationActionIconText: { color: '#167647', fontSize: 26, fontWeight: '700' },
  locationActionCopy: { flex: 1, marginLeft: 12 },
  locationActionTitle: { color: '#25352A', fontSize: 14, fontWeight: '800' },
  locationActionSubtitle: { marginTop: 4, color: '#7A887E', fontSize: 11 },
  actionChevron: { marginLeft: 8, color: '#789080', fontSize: 26 },
  loader: { marginVertical: 20 },
  inlineError: { padding: 14, borderRadius: 12, color: '#B42318', backgroundColor: '#FEECEB', fontSize: 13 },
  emptyCard: { paddingHorizontal: 22, paddingVertical: 25, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#E6EDE7', borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
  emptyIcon: { color: '#167647', fontSize: 26, fontWeight: '700' },
  emptyTitle: { marginTop: 9, color: '#25352A', fontSize: 15, fontWeight: '800' },
  emptyText: { maxWidth: 270, marginTop: 5, color: '#7A887E', fontSize: 12, lineHeight: 18, textAlign: 'center' },

  profileCard: { flexDirection: 'row', alignItems: 'center', marginTop: 32, padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6EDE7' },
  profileInitial: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDF2E3' },
  profileInitialText: { color: '#176B43', fontSize: 19, fontWeight: '800' },
  profileCopy: { flex: 1, marginLeft: 12 },
  profileName: { color: '#25352A', fontSize: 14, fontWeight: '800' },
  profileMeta: { marginTop: 3, color: '#7A887E', fontSize: 11 },
  profileStatus: { maxWidth: 88, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: '#E8F5EC' },
  profileStatusText: { color: '#176B43', fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  logoutButton: { marginTop: 14, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E1E7E2', backgroundColor: '#FFFFFF' },
  logoutText: { color: '#68766D', fontSize: 13, fontWeight: '700' },
  footerText: { marginTop: 18, color: '#9AA69D', fontSize: 10, textAlign: 'center', letterSpacing: 0.4 },
});
