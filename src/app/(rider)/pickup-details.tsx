import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { useLocalSearchParams } from 'expo-router';

import {
  getPickupById,
} from '../../services/firebase/pickups/pickup.services';

import type { Pickup } from '../../services/firebase/pickups/pickup.types';

import { useEffect, useState } from 'react';

export default function PickupDetailsScreen() {
  const { pickupId } = useLocalSearchParams<{
    pickupId: string;
  }>();

  const [pickup, setPickup] = useState<Pickup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

    async function handleNavigateToPickup() {
    if (!pickup?.pickupAddress) {
        Alert.alert(
        'Address Unavailable',
        'This pickup does not have a valid pickup address.',
        );

        return;
    }

    const destination = encodeURIComponent(
        pickup.pickupAddress,
    );

    const googleMapsUrl =
        `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

    try {
        const supported = await Linking.canOpenURL(
        googleMapsUrl,
        );

        if (!supported) {
        Alert.alert(
            'Navigation Unavailable',
            'Unable to open Google Maps.',
        );

        return;
        }

        await Linking.openURL(googleMapsUrl);
    } catch (error) {
        console.error(
        'Failed to open navigation:',
        error,
        );

        Alert.alert(
        'Navigation Error',
        'Unable to open navigation.',
        );
    }
    }

  useEffect(() => {
    async function loadPickup() {
    if (!pickupId) {
        setError('Pickup ID is missing.');
        setLoading(false);
        return;
    }

    try {
        setLoading(true);
        setError('');

        const result = await getPickupById(
        pickupId,
        );

        setPickup(result);
    } catch (error) {
        console.error(
        'Failed to load pickup:',
        error,
        );

        setError(
        'Failed to load pickup details.',
        );
    } finally {
        setLoading(false);
    }
    }

    loadPickup();
  }, [pickupId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          Loading pickup...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {error}
        </Text>
      </View>
    );
  }

  if (!pickup) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          Pickup not found.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
    <Pressable
    style={styles.backButton}
    onPress={() => router.back()}
    >
    <Text style={styles.backButtonText}>
        ← Back
    </Text>
    </Pressable>
      <Text style={styles.title}>
        Pickup Details
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Customer
        </Text>

        <Text style={styles.value}>
          {pickup.customerName}
        </Text>

        <Text style={styles.label}>
          Pickup Address
        </Text>

        <Text style={styles.value}>
          {pickup.pickupAddress}
        </Text>

        <Text style={styles.label}>
          Waste Type
        </Text>

        <Text style={styles.value}>
          {pickup.wasteTypeName}
        </Text>

        <Text style={styles.label}>
          Estimated Weight
        </Text>

        <Text style={styles.value}>
          {pickup.estimatedWeight} kg
        </Text>

        <Text style={styles.label}>
          Schedule
        </Text>

        <Text style={styles.value}>
          {pickup.scheduledDate} •{' '}
          {pickup.scheduledTime}
        </Text>

        <Text style={styles.label}>
          Status
        </Text>

        <Text style={styles.status}>
          {pickup.status}
        </Text>

        {pickup.notes && (
          <>
            <Text style={styles.label}>
              Notes
            </Text>

            <Text style={styles.value}>
              {pickup.notes}
            </Text>
          </>
        )}

        {pickup.status === 'accepted' && (
          <Pressable
            style={styles.navigateButton}
            onPress={handleNavigateToPickup}
          >
            <Text style={styles.navigateButtonText}>
              Navigate to Pickup
            </Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  content: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
    padding: 24,
    paddingTop: 70,
    paddingBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },

  card: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },

  label: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: '600',
  },

  value: {
    marginTop: 4,
    fontSize: 16,
  },

  status: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  message: {
    fontSize: 16,
  },

  error: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },

    backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

navigateButton: {
  marginTop: 24,
  paddingVertical: 15,
  borderRadius: 10,
  alignItems: 'center',
  backgroundColor: '#1b5e20',
},

navigateButtonText: {
  fontSize: 16,
  fontWeight: '700',
  color: '#ffffff',
},
});