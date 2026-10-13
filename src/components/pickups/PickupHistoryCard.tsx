import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Pickup } from '../../services/firebase/pickups/pickup.types';

interface PickupHistoryCardProps { pickup: Pickup; }

export default function PickupHistoryCard({ pickup }: PickupHistoryCardProps) {
  const router = useRouter();

  function openDetails() {
    router.push({ pathname: '/pickup-details', params: { pickupId: pickup.id } });
  }

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.icon}><Text style={styles.iconText}>✓</Text></View>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>COMPLETED COLLECTION</Text>
          <Text style={styles.customer} numberOfLines={1}>{pickup.customerName || 'Customer unavailable'}</Text>
        </View>
        <View style={styles.badge}><Text style={styles.badgeText}>Completed</Text></View>
      </View>
      <View style={styles.addressBox}>
        <Text style={styles.pin}>⌖</Text>
        <Text style={styles.address}>{pickup.pickupAddress || 'Pickup address unavailable'}</Text>
      </View>
      <View style={styles.detailsRow}>
        <View style={styles.detail}>
          <Text style={styles.label}>SCHEDULED</Text>
          <Text style={styles.value}>{pickup.scheduledDate || 'Not set'}</Text>
          <Text style={styles.muted}>{pickup.scheduledTime || 'Time not set'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.detail}>
          <Text style={styles.label}>WASTE COLLECTED</Text>
          <Text style={styles.value}>{pickup.wasteTypeName || 'Not specified'}</Text>
          <Text style={styles.muted}>{pickup.actualWeight ?? pickup.estimatedWeight ?? 0} kg recorded</Text>
        </View>
      </View>
      <Pressable style={styles.detailsButton} onPress={openDetails} accessibilityRole="button">
        <Text style={styles.detailsButtonText}>View pickup record  ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 13, padding: 16, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4ECE5' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5EC' },
  iconText: { color: '#176B43', fontSize: 22, fontWeight: '900' },
  heading: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  customer: { marginTop: 4, color: '#24342A', fontSize: 14, fontWeight: '800' },
  badge: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, backgroundColor: '#E8F5EC' },
  badgeText: { color: '#176B43', fontSize: 9, fontWeight: '800' },
  addressBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#F6F9F6' },
  pin: { color: '#167647', fontSize: 18, fontWeight: '800' },
  address: { flex: 1, color: '#435248', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  detailsRow: { flexDirection: 'row', marginTop: 16, marginBottom: 14 },
  detail: { flex: 1, minWidth: 0 },
  divider: { width: 1, marginHorizontal: 13, backgroundColor: '#E9EEEA' },
  label: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  value: { marginTop: 6, color: '#28382D', fontSize: 12, fontWeight: '800' },
  muted: { marginTop: 3, color: '#7B887F', fontSize: 10 },
  detailsButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#DCE7DE' },
  detailsButtonText: { color: '#176B43', fontSize: 11, fontWeight: '800' },
});
