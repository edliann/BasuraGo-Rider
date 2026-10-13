import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext/AuthContext';
import {
  completePickup,
  getPickupById,
  startPickup,
} from '../../services/firebase/pickups/pickup.services';
import type { Pickup } from '../../services/firebase/pickups/pickup.types';

type ActionType = 'start' | 'complete' | null;

const STATUS_LABELS: Record<string, string> = {
  pending: 'Available',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function PickupDetailsScreen() {
  const { pickupId } = useLocalSearchParams<{ pickupId: string }>();
  const { rider } = useAuth();

  const [pickup, setPickup] = useState<Pickup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<ActionType>(null);

  const loadPickup = useCallback(async () => {
    if (!pickupId || typeof pickupId !== 'string') {
      setError('Pickup ID is missing.');
      setLoading(false);
      return;
    }

    try {
      setError('');
      const result = await getPickupById(pickupId);
      setPickup(result);
      if (!result) setError('This pickup could not be found.');
    } catch (loadError) {
      console.error('Failed to load pickup details:', loadError);
      setError('We couldn’t load this pickup. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [pickupId]);

  useEffect(() => {
    setLoading(true);
    loadPickup();
  }, [loadPickup]);

  async function handleNavigateToPickup() {
    if (!pickup?.pickupAddress?.trim()) {
      Alert.alert('Address Unavailable', 'This pickup does not have a valid pickup address.');
      return;
    }

    const destination = encodeURIComponent(pickup.pickupAddress);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

    try {
      await Linking.openURL(url);
    } catch (navigationError) {
      console.error('Failed to open navigation:', navigationError);
      Alert.alert('Navigation Error', 'Unable to open directions. Please check that a maps app or browser is available.');
    }
  }

  async function handlePickupAction(action: Exclude<ActionType, null>) {
    if (!rider || !pickup) {
      Alert.alert('Rider Profile Unavailable', 'Please sign in again and try once more.');
      return;
    }

    try {
      setActionLoading(action);
      if (action === 'start') {
        await startPickup(pickup.id, rider.id);
        Alert.alert('Pickup Started', 'This collection is now marked as in progress.');
      } else {
        await completePickup(pickup.id, rider.id);
        Alert.alert('Pickup Completed', 'This collection has been marked as completed.');
      }
      await loadPickup();
    } catch (actionError) {
      console.error(`Failed to ${action} pickup:`, actionError);
      const message = actionError instanceof Error
        ? actionError.message
        : 'Something went wrong. Please try again.';
      Alert.alert(action === 'start' ? 'Unable to Start Pickup' : 'Unable to Complete Pickup', message);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#167647" />
        <Text style={styles.centerMessage}>Loading pickup details…</Text>
      </View>
    );
  }

  if (error || !pickup) {
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}><Text style={styles.errorIconText}>!</Text></View>
        <Text style={styles.errorTitle}>Pickup unavailable</Text>
        <Text style={styles.centerMessage}>{error || 'This pickup could not be found.'}</Text>
        <Pressable style={styles.primaryButton} onPress={() => { setLoading(true); loadPickup(); }}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const status = pickup.status?.toLowerCase() ?? 'pending';
  const statusLabel = STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
  const isActionInProgress = actionLoading !== null;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backButtonText}>‹  Back to dashboard</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.headerIcon}><Text style={styles.headerIconText}>♻</Text></View>
          <Text style={styles.eyebrow}>COLLECTION TASK</Text>
          <Text style={styles.title}>Pickup details</Text>
          <Text style={styles.subtitle}>Review the collection information before heading out.</Text>
          <View style={[styles.statusBadge, status === 'completed' ? styles.statusCompleted : status === 'in_progress' ? styles.statusInProgress : styles.statusDefault]}>
            <View style={[styles.statusDot, status === 'completed' ? styles.dotCompleted : status === 'in_progress' ? styles.dotInProgress : styles.dotDefault]} />
            <Text style={[styles.statusText, status === 'completed' ? styles.statusTextCompleted : status === 'in_progress' ? styles.statusTextInProgress : styles.statusTextDefault]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Customer & location</Text>
            <Text style={styles.sectionSymbol}>⌖</Text>
          </View>
          <Text style={styles.label}>CUSTOMER</Text>
          <Text style={styles.value}>{pickup.customerName || 'Customer information unavailable'}</Text>

          <View style={styles.divider} />
          <Text style={styles.label}>PICKUP ADDRESS</Text>
          <Text style={styles.value}>{pickup.pickupAddress || 'Address information unavailable'}</Text>
          {(status === 'accepted' || status === 'in_progress') && (
            <Pressable style={styles.navigationButton} onPress={handleNavigateToPickup}>
              <Text style={styles.navigationButtonText}>↗  Open directions</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collection information</Text>
            <Text style={styles.sectionSymbol}>▤</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoBlock}>
              <Text style={styles.label}>WASTE TYPE</Text>
              <Text style={styles.value}>{pickup.wasteTypeName || 'Not specified'}</Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={styles.label}>EST. WEIGHT</Text>
              <Text style={styles.value}>{pickup.estimatedWeight ?? 0} kg</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.label}>SCHEDULE</Text>
          <Text style={styles.value}>{pickup.scheduledDate || 'Date not set'} · {pickup.scheduledTime || 'Time not set'}</Text>
          <View style={styles.divider} />
          <Text style={styles.label}>DESTINATION FACILITY</Text>
          <Text style={styles.value}>{pickup.facilityName || 'Facility not assigned'}</Text>
          {pickup.facilityAddress ? <Text style={styles.secondaryValue}>{pickup.facilityAddress}</Text> : null}
          {pickup.vehicleId ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.label}>ASSIGNED VEHICLE</Text>
              <Text style={styles.value}>{pickup.vehicleId}</Text>
            </>
          ) : null}
        </View>

        {pickup.notes?.trim() ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>Important notes</Text>
            <Text style={styles.notesText}>{pickup.notes}</Text>
          </View>
        ) : null}

        {status === 'accepted' && (
          <View style={styles.nextStepCard}>
            <Text style={styles.nextStepEyebrow}>NEXT STEP</Text>
            <Text style={styles.nextStepTitle}>Ready to collect?</Text>
            <Text style={styles.nextStepDescription}>When you arrive and are ready to begin, start this pickup to update its status.</Text>
            <Pressable
              style={[styles.primaryButton, isActionInProgress && styles.buttonDisabled]}
              onPress={() => handlePickupAction('start')}
              disabled={isActionInProgress}
            >
              {actionLoading === 'start' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Start pickup</Text>}
            </Pressable>
          </View>
        )}

        {status === 'in_progress' && (
          <View style={styles.nextStepCard}>
            <Text style={styles.nextStepEyebrow}>PICKUP IN PROGRESS</Text>
            <Text style={styles.nextStepTitle}>Collection complete?</Text>
            <Text style={styles.nextStepDescription}>Only mark this task completed after the collection has been finished.</Text>
            <Pressable
              style={[styles.completeButton, isActionInProgress && styles.buttonDisabled]}
              onPress={() => handlePickupAction('complete')}
              disabled={isActionInProgress}
            >
              {actionLoading === 'complete' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Complete pickup</Text>}
            </Pressable>
          </View>
        )}

        {status === 'completed' && (
          <View style={styles.completedCard}>
            <Text style={styles.completedIcon}>✓</Text>
            <View style={styles.completedCopy}>
              <Text style={styles.completedTitle}>Pickup completed</Text>
              <Text style={styles.completedDescription}>This collection is recorded as completed.</Text>
            </View>
          </View>
        )}

        <Text style={styles.footerText}>BasuraGo Rider · Collect responsibly</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F5' },
  container: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#F5F8F5' },
  centerMessage: { marginTop: 10, maxWidth: 300, color: '#738077', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12, marginBottom: 18 },
  backButtonText: { color: '#176B43', fontSize: 13, fontWeight: '800' },

  header: { padding: 22, borderRadius: 24, backgroundColor: '#105C3B', marginBottom: 15 },
  headerIcon: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#D7F5A6', marginBottom: 19 },
  headerIconText: { color: '#105C3B', fontSize: 25, fontWeight: '800' },
  eyebrow: { color: '#BDE3C9', fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  title: { marginTop: 6, color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { marginTop: 7, maxWidth: 320, color: '#D3E9DA', fontSize: 12, lineHeight: 18 },
  statusBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 17, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10 },
  statusDefault: { backgroundColor: '#E7F5EC' },
  statusInProgress: { backgroundColor: '#FFF1CC' },
  statusCompleted: { backgroundColor: '#D7F5A6' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  dotDefault: { backgroundColor: '#176B43' },
  dotInProgress: { backgroundColor: '#B7791F' },
  dotCompleted: { backgroundColor: '#176B43' },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  statusTextDefault: { color: '#176B43' },
  statusTextInProgress: { color: '#8A5B10' },
  statusTextCompleted: { color: '#176B43' },

  card: { padding: 18, marginBottom: 13, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6EDE7' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 },
  sectionTitle: { color: '#1D2C22', fontSize: 16, fontWeight: '800' },
  sectionSymbol: { color: '#167647', fontSize: 22, fontWeight: '700' },
  label: { color: '#829087', fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  value: { marginTop: 6, color: '#26362B', fontSize: 14, fontWeight: '600', lineHeight: 21 },
  secondaryValue: { marginTop: 3, color: '#78867C', fontSize: 12, lineHeight: 18 },
  divider: { height: 1, marginVertical: 16, backgroundColor: '#EEF2EF' },
  infoRow: { flexDirection: 'row', gap: 14 },
  infoBlock: { flex: 1 },
  navigationButton: { alignSelf: 'flex-start', marginTop: 15, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 11, backgroundColor: '#E8F5EC' },
  navigationButtonText: { color: '#176B43', fontSize: 12, fontWeight: '800' },

  notesCard: { padding: 17, marginBottom: 13, borderRadius: 17, borderWidth: 1, borderColor: '#EBDCB6', backgroundColor: '#FFF9E9' },
  notesTitle: { color: '#775B1C', fontSize: 13, fontWeight: '800' },
  notesText: { marginTop: 6, color: '#6D5A32', fontSize: 13, lineHeight: 20 },
  nextStepCard: { padding: 19, marginTop: 2, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDEBE0' },
  nextStepEyebrow: { color: '#167647', fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  nextStepTitle: { marginTop: 7, color: '#1D2C22', fontSize: 18, fontWeight: '800' },
  nextStepDescription: { marginTop: 6, color: '#748178', fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingVertical: 14, borderRadius: 13, backgroundColor: '#167647' },
  completeButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingVertical: 14, borderRadius: 13, backgroundColor: '#105C3B' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  buttonDisabled: { opacity: 0.65 },
  completedCard: { flexDirection: 'row', alignItems: 'center', padding: 17, borderRadius: 17, backgroundColor: '#E8F5EC', borderWidth: 1, borderColor: '#C9E7D2' },
  completedIcon: { width: 37, height: 37, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', borderRadius: 13, backgroundColor: '#FFFFFF', color: '#176B43', fontSize: 23, fontWeight: '800' },
  completedCopy: { flex: 1, marginLeft: 12 },
  completedTitle: { color: '#176B43', fontSize: 14, fontWeight: '800' },
  completedDescription: { marginTop: 3, color: '#5C7966', fontSize: 11, lineHeight: 16 },
  errorIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEECEB' },
  errorIconText: { color: '#B42318', fontSize: 22, fontWeight: '800' },
  errorTitle: { marginTop: 14, color: '#25352A', fontSize: 18, fontWeight: '800' },
  primaryButtonTextUnused: { color: '#FFFFFF' },
  backLink: { marginTop: 16, padding: 10 },
  backLinkText: { color: '#176B43', fontSize: 13, fontWeight: '800' },
  footerText: { marginTop: 22, color: '#9AA69D', fontSize: 10, textAlign: 'center', letterSpacing: 0.4 },
});
