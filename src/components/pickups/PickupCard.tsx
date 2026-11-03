import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Pickup } from '../../services/firebase/pickups/pickup.types';
import RemixIcon from 'react-native-remix-icon';

interface PickupCardProps {
  pickup: Pickup;
  accepting: boolean;
  onAccept: (pickupId: string) => void;
}

export default function PickupCard({ pickup, accepting, onAccept }: PickupCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>NEW REQUEST</Text>
          <Text style={styles.customer} numberOfLines={1}>Customer details after acceptance</Text>
        </View>
        <View style={styles.badge}><View style={styles.dot} /><Text style={styles.badgeText}>Available</Text></View>
      </View>
      <View style={styles.addressBox}><RemixIcon name="map-pin-line" size={18} color="#176744" accessible={false} /><Text style={styles.address}>{pickup.pickupLocation ? 'Pickup coordinates available on map' : 'Pickup coordinates unavailable'}</Text></View>
      <View style={styles.detailsRow}>
        <View style={styles.detail}><Text style={styles.label}>SCHEDULE</Text><Text style={styles.value}>{pickup.scheduledDate || 'Not set'}</Text><Text style={styles.muted}>{pickup.scheduledTime || 'Time not set'}</Text></View>
        <View style={styles.divider} />
        <View style={styles.detail}><Text style={styles.label}>WASTE TYPE</Text><Text style={styles.value}>{pickup.items?.length ? pickup.items.map((item) => `${item.wasteTypeName} (${item.quantity})`).join(', ') : pickup.wasteTypeName || 'Not specified'}</Text><Text style={styles.muted}>{pickup.estimatedWeight ?? 0} kg estimated</Text></View>
      </View>
      {pickup.facilityName ? <View style={styles.facility}><Text style={styles.label}>DESTINATION FACILITY</Text><Text style={styles.value}>{pickup.facilityName}</Text><Text style={styles.muted}>{pickup.facilityAddress}</Text></View> : null}
      <View style={styles.actions}>
        <Pressable style={[styles.acceptButton, accepting && styles.disabled]} onPress={() => onAccept(pickup.id)} disabled={accepting}>
          {accepting ? <View style={styles.accepting}><ActivityIndicator color="#FFFFFF" size="small" /><Text style={styles.acceptText}>Accepting…</Text></View> : <Text style={styles.acceptText}>Accept pickup</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 13, padding: 18, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8DE' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5EC' },
  iconText: { color: '#176744', fontSize: 22, fontWeight: '800' },
  heading: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  customer: { marginTop: 4, color: '#173D2C', fontSize: 14, fontWeight: '800' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 9, backgroundColor: '#E8F5EC' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#176744' },
  badgeText: { color: '#176744', fontSize: 9, fontWeight: '800' },
  addressBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#F5F8F6' },
  address: { flex: 1, color: '#435248', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  detailsRow: { flexDirection: 'row', marginTop: 16, marginBottom: 14 },
  detail: { flex: 1, minWidth: 0 },
  divider: { width: 1, marginHorizontal: 13, backgroundColor: '#E9EEEA' },
  label: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  value: { marginTop: 6, color: '#28382D', fontSize: 12, fontWeight: '800' },
  muted: { marginTop: 3, color: '#7B887F', fontSize: 10 },
  facility: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF2EF' },
  notes: { marginTop: 12, padding: 11, borderRadius: 10, backgroundColor: '#FFF9E9' },
  noteText: { marginTop: 5, color: '#6D5A32', fontSize: 11, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 15 },
  secondaryButton: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#DCE8DE' },
  secondaryText: { color: '#176744', fontSize: 11, fontWeight: '800' },
  acceptButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 14, backgroundColor: '#176744' },
  disabled: { opacity: 0.65 },
  accepting: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  acceptText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
