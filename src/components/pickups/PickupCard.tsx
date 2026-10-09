import {
  Alert,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRef, useState } from 'react';

import type { Pickup } from '../../services/firebase/pickups/pickup.types';

import {
  acceptPickup,
} from '../../services/firebase/pickups/pickup-acceptance.services';

interface PickupCardProps {
  pickup: Pickup;
  onAccepted: () => void;
}

export default function PickupCard({
  pickup,
  onAccepted,
}: PickupCardProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const acceptingRef = useRef(false);

  async function handleAccept() {
    if (acceptingRef.current) {
      return;
    }

    acceptingRef.current = true;
    setIsAccepting(true);

    try {
      await acceptPickup(pickup.id);

      Alert.alert(
        'Pickup Accepted',
        'This pickup has been added to your assigned pickups.',
      );

      onAccepted();
    } catch (error) {
      console.error(
        'Failed to accept pickup:',
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to accept this pickup.';

      Alert.alert(
        'Unable to Accept Pickup',
        message,
      );
    } finally {
      acceptingRef.current = false;
      setIsAccepting(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        Available Pickup
      </Text>

      <View style={styles.divider} />

      <Text style={styles.label}>
        Customer
      </Text>

      <Text style={styles.value}>
        {pickup.customerName ||
          'Customer information unavailable'}
      </Text>

      <Text style={styles.label}>
        Pickup Address
      </Text>

      <Text style={styles.value}>
        {pickup.pickupAddress ||
          'Address information unavailable'}
      </Text>

      <Text style={styles.label}>
        Assigned Facility
      </Text>

      <Text style={styles.value}>
        {pickup.facilityName && pickup.facilityAddress
          ? `${pickup.facilityName} — ${pickup.facilityAddress}`
          : 'Facility destination unavailable'}
      </Text>

      <Text style={styles.label}>
        Waste Type
      </Text>

      <Text style={styles.value}>
        {pickup.wasteTypeName ||
          'Waste type unavailable'}
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

      <Pressable
        style={[
          styles.acceptButton,
          isAccepting && styles.acceptButtonDisabled,
        ]}
        onPress={handleAccept}
        disabled={isAccepting}
      >
        {isAccepting ? (
          <View style={styles.acceptingContent}>
            <ActivityIndicator color="#ffffff" />
            <Text
              style={[
                styles.acceptButtonText,
                styles.acceptingLabel,
              ]}
            >
              Accepting...
            </Text>
          </View>
        ) : (
          <Text style={styles.acceptButtonText}>
            Accept Pickup
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
  },

  divider: {
    height: 1,
    marginVertical: 14,
    backgroundColor: '#dddddd',
  },

  label: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
  },

  value: {
    marginTop: 4,
    fontSize: 16,
  },

  acceptButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#1b5e20',
  },

  acceptButtonDisabled: {
    opacity: 0.7,
  },

  acceptingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  acceptingLabel: {
    marginLeft: 8,
  },

  acceptButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});