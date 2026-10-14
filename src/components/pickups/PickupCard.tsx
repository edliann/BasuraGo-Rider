import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRef, useState } from 'react';
import type { Pickup } from '../../services/firebase/pickups/pickup.types';
import { acceptPickup } from '../../services/firebase/pickups/pickup-acceptance.services';
import { MOCK_PICKUP_MODE } from '../../dev/mockPickups';

interface PickupCardProps { pickup: Pickup; onAccepted: () => void; }

export default function PickupCard({ pickup, onAccepted }: PickupCardProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const lock = useRef(false);

  async function handleAccept() {
    if (lock.current) return;
    lock.current = true;
    setIsAccepting(true);
    try {
      await acceptPickup(pickup.id);
      Alert.alert('Pickup Accepted', MOCK_PICKUP_MODE ? 'Demo only: this change is held in memory and is not saved to Firebase.' : 'This pickup has been added to your assigned pickups.');
      onAccepted();
    } catch (error) {
      console.error('Failed to accept pickup:', error);
      Alert.alert('Unable to Accept Pickup', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      lock.current = false;
      setIsAccepting(false);
    }
  }

  return (
    <View style={styles.card}>
      {MOCK_PICKUP_MODE ? <View style={styles.demoBanner}><Text style={styles.demoText}>DEMO DATA · NOT SAVED</Text></View> : null}
      <View style={styles.top}>
        <View style={styles.icon}><Text style={styles.iconText}>＋</Text></View>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>NEW REQUEST</Text>
          <Text style={styles.customer} numberOfLines={1}>Customer details after acceptance</Text>
        </View>
        <View style={styles.badge}><View style={styles.dot} /><Text style={styles.badgeText}>Available</Text></View>
      </View>
      <View style={styles.addressBox}><Text style={styles.pin}>⌖</Text><Text style={styles.address}>{pickup.pickupLocation ? 'Pickup coordinates available on map' : 'Pickup coordinates unavailable'}</Text></View>
      <View style={styles.detailsRow}>
        <View style={styles.detail}><Text style={styles.label}>SCHEDULE</Text><Text style={styles.value}>{pickup.scheduledDate || 'Not set'}</Text><Text style={styles.muted}>{pickup.scheduledTime || 'Time not set'}</Text></View>
        <View style={styles.divider} />
        <View style={styles.detail}><Text style={styles.label}>WASTE TYPE</Text><Text style={styles.value}>{pickup.wasteTypeName || 'Not specified'}</Text><Text style={styles.muted}>{pickup.estimatedWeight ?? 0} kg estimated</Text></View>
      </View>
      {pickup.facilityName ? <View style={styles.facility}><Text style={styles.label}>DESTINATION FACILITY</Text><Text style={styles.value}>{pickup.facilityName}</Text><Text style={styles.muted}>{pickup.facilityAddress}</Text></View> : null}
      <View style={styles.actions}>
        <Pressable style={[styles.acceptButton, isAccepting && styles.disabled]} onPress={handleAccept} disabled={isAccepting}>
          {isAccepting ? <View style={styles.accepting}><ActivityIndicator color="#FFFFFF" size="small" /><Text style={styles.acceptText}>Accepting…</Text></View> : <Text style={styles.acceptText}>Accept pickup</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 13, padding: 16, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4ECE5' },
  demoBanner: { alignSelf: 'flex-start', marginBottom: 12, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, backgroundColor: '#FFF1CC' },
  demoText: { color: '#8A5B10', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5EC' },
  iconText: { color: '#176B43', fontSize: 22, fontWeight: '800' },
  heading: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#87948A', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  customer: { marginTop: 4, color: '#24342A', fontSize: 14, fontWeight: '800' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 9, backgroundColor: '#E8F5EC' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#167647' },
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
  facility: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF2EF' },
  notes: { marginTop: 12, padding: 11, borderRadius: 10, backgroundColor: '#FFF9E9' },
  noteText: { marginTop: 5, color: '#6D5A32', fontSize: 11, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 15 },
  secondaryButton: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#DCE7DE' },
  secondaryText: { color: '#176B43', fontSize: 11, fontWeight: '800' },
  acceptButton: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 12, backgroundColor: '#167647' },
  disabled: { opacity: 0.65 },
  accepting: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  acceptText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
