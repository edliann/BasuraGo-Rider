import {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {router, useLocalSearchParams} from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useAuth} from '../../contexts/AuthContext/AuthContext';
import {getPickupByIdFromServer} from '../../services/firebase/pickups/pickup.services';
import type {Pickup} from '../../services/firebase/pickups/pickup.types';
import {createPickupQrPayload} from '../../services/firebase/pickups/pickupQr';

const PRESENTABLE_STATUSES = new Set([
  'accepted',
  'in_progress',
  'awaiting_facility_receipt',
  'completed',
]);

export default function PickupQrScreen() {
  const {pickupId} = useLocalSearchParams<{pickupId?: string}>();
  const {rider, loading: authLoading} = useAuth();
  const [pickup, setPickup] = useState<Pickup | null>(null);
  const [loadedPickupId, setLoadedPickupId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const loading = authLoading || loadedPickupId !== pickupId;

  const loadPickup = useCallback(async () => {
    if (authLoading) return;
    if (!rider) {
      setError('Sign in with an active Rider account to present this pickup.');
      setPickup(null);
      setLoadedPickupId(pickupId ?? '');
      return;
    }
    if (
      typeof pickupId !== 'string' ||
      !pickupId.trim() ||
      pickupId.length > 128 ||
      pickupId.includes('/')
    ) {
      setError('This pickup reference is invalid. Return to your pickup list and try again.');
      setPickup(null);
      setLoadedPickupId(pickupId ?? '');
      return;
    }

    setError('');
    try {
      const result = await getPickupByIdFromServer(pickupId);
      if (!result || result.riderId !== rider.id) {
        setPickup(null);
        setError('This pickup is not assigned to your Rider account.');
      } else if (!PRESENTABLE_STATUSES.has(result.status.toLowerCase())) {
        setPickup(null);
        setError('This pickup is not eligible for facility receipt.');
      } else if (
        result.actualWeight !== null ||
        result.facilityReceipt !== null
      ) {
        setPickup(null);
        setError('A facility receipt has already been recorded for this pickup.');
      } else {
        setPickup(result);
      }
    } catch (loadError) {
      console.error('Failed to validate pickup for QR presentation:', loadError);
      setPickup(null);
      setError('Unable to verify this pickup. Check your connection and try again.');
    } finally {
      setLoadedPickupId(pickupId);
    }
  }, [authLoading, pickupId, rider]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadPickup();
    });
    return () => {
      active = false;
    };
  }, [loadPickup]);

  const payload = pickup ? createPickupQrPayload(pickup.id) : '';

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#176744" />
        <Text style={styles.message}>Verifying pickup eligibility…</Text>
      </SafeAreaView>
    );
  }

  if (!pickup || error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Pickup QR unavailable</Text>
        <Text style={styles.message}>{error || 'This pickup cannot be presented.'}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back to pickup</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Pressable accessibilityRole="button" style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>‹  Back to pickup</Text>
        </Pressable>
        <Text style={styles.eyebrow}>FACILITY RECEIPT</Text>
        <Text style={styles.title}>Present Pickup QR</Text>
        <Text style={styles.message}>
          Facility staff will scan this code and verify the pickup against their assigned facility.
        </Text>

        <View style={styles.qrFrame}>
          <QRCode value={payload} size={244} color="#173D2C" backgroundColor="#FFFFFF" />
        </View>

        <View style={styles.reference}>
          <Text style={styles.label}>PICKUP REFERENCE</Text>
          <Text selectable style={styles.pickupId}>{pickup.id}</Text>
          <Text style={styles.label}>STATUS</Text>
          <Text style={styles.status}>{pickup.status.replace(/_/g, ' ')}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F5F8F6'},
  content: {flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 12, paddingBottom: 32},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#F5F8F6'},
  back: {minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 24},
  backText: {color: '#176744', fontSize: 13, fontWeight: '800'},
  eyebrow: {color: '#66806D', fontSize: 10, fontWeight: '800'},
  title: {marginTop: 7, color: '#173D2C', fontSize: 25, fontWeight: '800', textAlign: 'center'},
  message: {marginTop: 10, maxWidth: 330, color: '#64736A', fontSize: 13, lineHeight: 20, textAlign: 'center'},
  qrFrame: {alignSelf: 'center', marginTop: 28, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8DE'},
  reference: {marginTop: 24, padding: 18, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8DE'},
  label: {color: '#829087', fontSize: 9, fontWeight: '800'},
  pickupId: {marginTop: 6, marginBottom: 17, color: '#173D2C', fontSize: 14, fontWeight: '700'},
  status: {marginTop: 6, color: '#176744', fontSize: 15, fontWeight: '800', textTransform: 'capitalize'},
  button: {minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#176744'},
  buttonText: {color: '#FFFFFF', fontSize: 13, fontWeight: '800'},
});