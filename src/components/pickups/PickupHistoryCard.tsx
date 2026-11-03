import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getFacilityReceivedWeight,
  type Pickup,
} from '../../services/firebase/pickups/pickup.types';
import RemixIcon from 'react-native-remix-icon';

interface PickupHistoryCardProps { pickup: Pickup; }

export default function PickupHistoryCard({ pickup }: PickupHistoryCardProps) {
  const router = useRouter();
  const cancelled = pickup.status === 'cancelled' || pickup.status === 'canceled';
  const facilityReceivedWeight = getFacilityReceivedWeight(pickup);
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.heading}><Text style={styles.eyebrow}>{cancelled ? 'CANCELLED PICKUP' : 'COMPLETED COLLECTION'}</Text><Text style={styles.customer} numberOfLines={1}>{pickup.customerName || 'Customer unavailable'}</Text></View>
        <View style={[styles.badge, cancelled && styles.cancelledBadge]}><Text style={[styles.badgeText, cancelled && styles.cancelledBadgeText]}>{cancelled ? 'Cancelled' : 'Completed'}</Text></View>
      </View>
      <View style={styles.addressBox}><RemixIcon name="map-pin-line" size={18} color="#176744" accessible={false} /><Text style={styles.address}>{pickup.pickupAddress || 'Pickup address unavailable'}</Text></View>
      <View style={styles.detailsRow}>
        <View style={styles.detail}><Text style={styles.label}>SCHEDULED</Text><Text style={styles.value}>{pickup.scheduledDate || 'Not set'}</Text><Text style={styles.muted}>{pickup.scheduledTime || 'Time not set'}</Text></View>
        <View style={styles.divider} />
        <View style={styles.detail}>
          <Text style={styles.label}>{cancelled ? 'WASTE TYPE' : 'WASTE COLLECTED'}</Text>
          <Text style={styles.value}>
            {pickup.items?.length
              ? pickup.items.map((item) => `${item.wasteTypeName} (${item.quantity})`).join(', ')
              : pickup.wasteTypeName || 'Not specified'}
          </Text>
          {cancelled ? (
            <Text style={styles.muted}>
              {pickup.cancellationReason || 'Collection was cancelled before completion.'}
            </Text>
          ) : (
            <Text style={styles.muted}>
              Facility received: {facilityReceivedWeight !== null
                ? `${facilityReceivedWeight} kg`
                : 'weight unavailable'}
            </Text>
          )}
          {!cancelled && pickup.collectedWeightKg !== null ? (
            <Text style={styles.muted}>
              Rider collection: {pickup.collectedWeightKg} kg
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/pickup-details', params: { pickupId: pickup.id, from: '/pickup-history' } })} style={styles.detailsButton}><Text style={styles.detailsButtonText}>View pickup record  ›</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 13, padding: 18, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8DE' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 }, icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5EC' }, iconText: { color: '#176744', fontSize: 22, fontWeight: '900' },
  heading: { flex: 1, minWidth: 0 }, eyebrow: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 1 }, customer: { marginTop: 4, color: '#173D2C', fontSize: 14, fontWeight: '800' },
  badge: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, backgroundColor: '#E8F5EC' }, cancelledBadge: { backgroundColor: '#FFF1CC' }, badgeText: { color: '#176744', fontSize: 9, fontWeight: '800' }, cancelledBadgeText: { color: '#8A5A00' },
  addressBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#F5F8F6' }, address: { flex: 1, color: '#435248', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  detailsRow: { flexDirection: 'row', marginTop: 16, marginBottom: 14 }, detail: { flex: 1, minWidth: 0 }, divider: { width: 1, marginHorizontal: 13, backgroundColor: '#E9EEEA' }, label: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 1 }, value: { marginTop: 6, color: '#28382D', fontSize: 12, fontWeight: '800' }, muted: { marginTop: 3, color: '#7B887F', fontSize: 10 },
  detailsButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#DCE8DE' }, detailsButtonText: { color: '#176744', fontSize: 11, fontWeight: '800' },
});
