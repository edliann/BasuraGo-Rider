import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { completePickup, startPickup } from '../../services/firebase/pickups/pickup.services';
import {
  getPickupCancellationLabel,
  getPickupPricingState,
  type Pickup,
} from '../../services/firebase/pickups/pickup.types';
import RemixIcon from 'react-native-remix-icon';

interface MyPickupCardProps {
  pickup: Pickup;
  returnTo: '/available-pickups' | '/my-pickups';
  onStarted: () => void;
}

export default function MyPickupCard({ pickup, returnTo, onStarted }: MyPickupCardProps) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<'start' | 'complete' | null>(null);
  const lock = useRef(false);
  const inProgress = pickup.status === 'in_progress';
  const awaitingFacilityReceipt = pickup.status === 'awaiting_facility_receipt';
  const cancelled = pickup.status === 'cancelled' || pickup.status === 'canceled';
  const pricingState = getPickupPricingState(pickup);
  const canStart = pickup.status === 'accepted' && pricingState.canStart;

  function openDetails() {
    router.push({ pathname: '/pickup-details', params: { pickupId: pickup.id, from: returnTo } });
  }

  async function handleAction(action: 'start' | 'complete') {
    if (lock.current) return;
    lock.current = true;
    setActionLoading(action);
    try {
      if (action === 'start') {
        await startPickup(pickup.id);
        Alert.alert('Pickup Started', 'This pickup is now in progress.');
      } else {
        const result = await completePickup(pickup.id);
        Alert.alert(
          result.status === 'completed' ? 'Pickup Received' : 'Collection Complete',
          result.status === 'completed'
            ? 'Facility receipt has already been recorded. This pickup is completed.'
            : 'Collection is complete and is now awaiting facility receipt.',
        );
      }
      onStarted();
    } catch (error) {
      console.error(`Failed to ${action} pickup:`, error);
      Alert.alert('Pickup Update Failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      lock.current = false;
      setActionLoading(null);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>ASSIGNED COLLECTION</Text>
          <Text style={styles.customerName} numberOfLines={1}>{pickup.customerName || 'Customer not available'}</Text>
        </View>
        <View style={[styles.statusBadge, (inProgress || awaitingFacilityReceipt) ? styles.statusProgress : styles.statusAccepted]}>
          <View style={[styles.statusDot, (inProgress || awaitingFacilityReceipt) ? styles.dotProgress : styles.dotAccepted]} />
          <Text style={[styles.statusText, (inProgress || awaitingFacilityReceipt) ? styles.statusTextProgress : styles.statusTextAccepted]}>{cancelled ? getPickupCancellationLabel(pickup) : pricingState.label ?? (inProgress ? 'In progress' : 'Accepted')}</Text>
        </View>
      </View>
      <View style={styles.addressRow}><RemixIcon name="map-pin-line" size={18} color="#176744" accessible={false} /><Text style={styles.address}>{pickup.pickupAddress || 'Pickup address unavailable'}</Text></View>
      <View style={styles.metadata}>
        <View style={styles.metaItem}><Text style={styles.metaLabel}>SCHEDULE</Text><Text style={styles.metaValue}>{pickup.scheduledDate || 'Not set'}</Text><Text style={styles.metaSubValue}>{pickup.scheduledTime || 'Time not set'}</Text></View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}><Text style={styles.metaLabel}>WASTE TYPE</Text><Text style={styles.metaValue}>{pickup.items?.length ? pickup.items.map((item) => `${item.wasteTypeName} (${item.quantity})`).join(', ') : pickup.wasteTypeName || 'Not specified'}</Text><Text style={styles.metaSubValue}>{pickup.estimatedWeight ?? 0} kg estimated</Text></View>
      </View>
      {pickup.facilityName ? <View style={styles.facilityRow}><View style={styles.facilityCopy}><Text style={styles.facilityLabel}>DESTINATION FACILITY</Text><Text style={styles.facilityName}>{pickup.facilityName}</Text></View></View> : null}
      {pricingState.message ? <Text style={styles.pricingMessage}>{pricingState.message}</Text> : null}
      <View style={styles.actions}>
        <Pressable style={styles.detailsButton} onPress={openDetails}><Text style={styles.detailsButtonText}>View details</Text></Pressable>
        {!cancelled ? (
          <Pressable
            style={[
              styles.primaryButton,
              inProgress && styles.completeButton,
              (!inProgress && !canStart || actionLoading !== null) && styles.disabledButton,
            ]}
            onPress={() => handleAction(inProgress ? 'complete' : 'start')}
            disabled={
              actionLoading !== null ||
              awaitingFacilityReceipt ||
              (!inProgress && !canStart)
            }
          >
            {awaitingFacilityReceipt ? (
              <Text style={styles.primaryButtonText}>Awaiting facility receipt</Text>
            ) : actionLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {inProgress
                  ? 'Complete Collection'
                  : canStart
                    ? 'Start pickup'
                    : 'Awaiting pricing'}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 13, padding: 18, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8DE' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5EC' },
  typeIconText: { color: '#176744', fontSize: 22, fontWeight: '800' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  customerName: { marginTop: 4, color: '#173D2C', fontSize: 14, fontWeight: '800' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 9 },
  statusAccepted: { backgroundColor: '#E8F5EC' }, statusProgress: { backgroundColor: '#FFF1CC' },
  statusDot: { width: 6, height: 6, borderRadius: 3 }, dotAccepted: { backgroundColor: '#176744' }, dotProgress: { backgroundColor: '#B7791F' },
  statusText: { fontSize: 9, fontWeight: '800' }, statusTextAccepted: { color: '#176744' }, statusTextProgress: { color: '#A56500' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#F5F8F6' },
  address: { flex: 1, color: '#435248', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  metadata: { flexDirection: 'row', marginTop: 16, marginBottom: 14 }, metaItem: { flex: 1, minWidth: 0 }, metaDivider: { width: 1, marginHorizontal: 13, backgroundColor: '#E9EEEA' },
  metaLabel: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 1 }, metaValue: { marginTop: 6, color: '#28382D', fontSize: 12, fontWeight: '800' }, metaSubValue: { marginTop: 3, color: '#7B887F', fontSize: 10 },
  facilityRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#EEF2EF' }, facilityIcon: { color: '#176744', fontSize: 17 }, facilityCopy: { flex: 1 }, facilityLabel: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 0.9 }, facilityName: { marginTop: 4, color: '#435248', fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 9, marginTop: 15 }, detailsButton: { flex: 1, minHeight: 43, padding: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DCE8DE' }, detailsButtonText: { color: '#176744', fontSize: 11, fontWeight: '800' },
  primaryButton: { flex: 1, minHeight: 46, padding: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#176744' }, completeButton: { backgroundColor: '#124D33' }, primaryButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' }, disabledButton: { opacity: 0.65 },
  pricingMessage: { marginTop: 12, color: '#6D5A24', fontSize: 11, lineHeight: 16 },
});
