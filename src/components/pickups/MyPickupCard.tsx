import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { completePickup, startPickup } from '../../services/firebase/pickups/pickup.services';
import type { Pickup } from '../../services/firebase/pickups/pickup.types';

interface MyPickupCardProps {
  pickup: Pickup;
  riderId: string;
  onStarted: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
};

export default function MyPickupCard({ pickup, riderId, onStarted }: MyPickupCardProps) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<'start' | 'complete' | null>(null);
  const actionLock = useRef(false);

  function openDetails() {
    router.push({ pathname: '/pickup-details', params: { pickupId: pickup.id } });
  }

  async function handleAction(action: 'start' | 'complete') {
    if (actionLock.current) return;
    actionLock.current = true;
    setActionLoading(action);

    try {
      if (action === 'start') {
        await startPickup(pickup.id, riderId);
        Alert.alert('Pickup Started', 'This pickup is now in progress.');
      } else {
        await completePickup(pickup.id, riderId);
        Alert.alert('Pickup Completed', 'This pickup has been completed successfully.');
      }
      onStarted();
    } catch (error) {
      console.error(`Failed to ${action} pickup:`, error);
      const message = error instanceof Error ? error.message : `Unable to ${action} this pickup.`;
      Alert.alert(action === 'start' ? 'Unable to Start Pickup' : 'Unable to Complete Pickup', message);
    } finally {
      actionLock.current = false;
      setActionLoading(null);
    }
  }

  const inProgress = pickup.status === 'in_progress';
  const statusLabel = STATUS_LABELS[pickup.status] ?? pickup.status.replace(/_/g, ' ');

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.typeIcon}><Text style={styles.typeIconText}>♻</Text></View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>ASSIGNED COLLECTION</Text>
          <Text style={styles.customerName} numberOfLines={1}>{pickup.customerName || 'Customer not available'}</Text>
        </View>
        <View style={[styles.statusBadge, inProgress ? styles.statusProgress : styles.statusAccepted]}>
          <View style={[styles.statusDot, inProgress ? styles.dotProgress : styles.dotAccepted]} />
          <Text style={[styles.statusText, inProgress ? styles.statusTextProgress : styles.statusTextAccepted]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.addressRow}>
        <Text style={styles.pin}>⌖</Text>
        <Text style={styles.address} numberOfLines={3}>{pickup.pickupAddress || 'Pickup address unavailable'}</Text>
      </View>

      <View style={styles.metadata}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>SCHEDULE</Text>
          <Text style={styles.metaValue}>{pickup.scheduledDate || 'Not set'}</Text>
          <Text style={styles.metaSubValue}>{pickup.scheduledTime || 'Time not set'}</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>WASTE TYPE</Text>
          <Text style={styles.metaValue} numberOfLines={2}>{pickup.wasteTypeName || 'Not specified'}</Text>
          <Text style={styles.metaSubValue}>{pickup.estimatedWeight ?? 0} kg estimated</Text>
        </View>
      </View>

      {pickup.facilityName ? (
        <View style={styles.facilityRow}>
          <Text style={styles.facilityIcon}>▣</Text>
          <View style={styles.facilityCopy}>
            <Text style={styles.facilityLabel}>DESTINATION FACILITY</Text>
            <Text style={styles.facilityName} numberOfLines={2}>{pickup.facilityName}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.detailsButton} onPress={openDetails} accessibilityRole="button">
          <Text style={styles.detailsButtonText}>View details</Text>
        </Pressable>
        {pickup.status === 'accepted' && (
          <Pressable
            style={[styles.primaryButton, actionLoading !== null && styles.disabledButton]}
            onPress={() => handleAction('start')}
            disabled={actionLoading !== null}
            accessibilityRole="button"
          >
            {actionLoading === 'start' ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.primaryButtonText}>Start pickup</Text>}
          </Pressable>
        )}
        {inProgress && (
          <Pressable
            style={[styles.primaryButton, styles.completeButton, actionLoading !== null && styles.disabledButton]}
            onPress={() => handleAction('complete')}
            disabled={actionLoading !== null}
            accessibilityRole="button"
          >
            {actionLoading === 'complete' ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.primaryButtonText}>Complete</Text>}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 13, padding: 16, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4ECE5' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5EC' },
  typeIconText: { color: '#176B43', fontSize: 22, fontWeight: '800' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  customerName: { marginTop: 4, color: '#24342A', fontSize: 14, fontWeight: '800' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 9 },
  statusAccepted: { backgroundColor: '#E8F5EC' },
  statusProgress: { backgroundColor: '#FFF1CC' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotAccepted: { backgroundColor: '#167647' },
  dotProgress: { backgroundColor: '#B7791F' },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'capitalize' },
  statusTextAccepted: { color: '#176B43' },
  statusTextProgress: { color: '#8A5B10' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 17, padding: 12, borderRadius: 12, backgroundColor: '#F6F9F6' },
  pin: { color: '#167647', fontSize: 18, fontWeight: '800' },
  address: { flex: 1, color: '#435248', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  metadata: { flexDirection: 'row', marginTop: 16, marginBottom: 14 },
  metaItem: { flex: 1, minWidth: 0 },
  metaDivider: { width: 1, marginHorizontal: 13, backgroundColor: '#E9EEEA' },
  metaLabel: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  metaValue: { marginTop: 6, color: '#28382D', fontSize: 12, fontWeight: '800' },
  metaSubValue: { marginTop: 3, color: '#7B887F', fontSize: 10 },
  facilityRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#EEF2EF' },
  facilityIcon: { color: '#167647', fontSize: 17 },
  facilityCopy: { flex: 1 },
  facilityLabel: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 0.9 },
  facilityName: { marginTop: 4, color: '#435248', fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 9, marginTop: 15 },
  detailsButton: { flex: 1, minHeight: 43, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DCE7DE', backgroundColor: '#FFFFFF' },
  detailsButtonText: { color: '#176B43', fontSize: 11, fontWeight: '800' },
  primaryButton: { flex: 1, minHeight: 43, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#167647' },
  completeButton: { backgroundColor: '#105C3B' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
});
