import {
    Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useRouter } from 'expo-router';

import type {
  Pickup,
} from '../../services/firebase/pickups/pickup.types';

interface PickupHistoryCardProps {
  pickup: Pickup;
}

export default function PickupHistoryCard({
  pickup,
}: PickupHistoryCardProps) {
  const router = useRouter();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        Completed Pickup
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
        Completed
      </Text>

      <Text style={styles.value}>
        {pickup.scheduledDate} •{' '}
        {pickup.scheduledTime}
      </Text>

      <Text style={styles.status}>
        Completed
      </Text>
    <Pressable
    style={styles.detailsButton}
    onPress={() =>
        router.push({
        pathname: '/pickup-details',
        params: {
            pickupId: pickup.id,
        },
        })
    }
    >
    <Text style={styles.detailsButtonText}>
        View Pickup Details
    </Text>
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

  status: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '700',
  },
  detailsButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1b5e20',
  },

    detailsButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1b5e20',
  },
});