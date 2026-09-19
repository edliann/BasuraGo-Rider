import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useRouter } from 'expo-router';

import {
  completePickup,
  startPickup,
} from '../../services/firebase/pickups/pickup.services';

import type {
  Pickup,
} from '../../services/firebase/pickups/pickup.types';


interface MyPickupCardProps {
  pickup: Pickup;
  riderId: string;
  onStarted: () => void;
}

export default function MyPickupCard({
  pickup,
  riderId,
  onStarted,
}: MyPickupCardProps) {

const router = useRouter();

    async function handleStart() {
        try {
            await startPickup(
                pickup.id,
                riderId,
            );

            Alert.alert(
                'Pickup Started',
                'This pickup is now in progress.',
            );

            onStarted();
        } catch (error) {
            console.error(
                'Failed to start pickup:',
                error,
            );

            const message =
                error instanceof Error
                    ? error.message
                    : 'Unable to start this pickup.';

            Alert.alert(
                'Unable to Start Pickup',
                message,
            );
        }
    }

    async function handleComplete() {
        try {
            await completePickup(
                pickup.id,
                riderId,
            );

            Alert.alert(
                'Pickup Completed',
                'This pickup has been completed successfully.',
            );

            onStarted();
        } catch (error) {
            console.error(
                'Failed to complete pickup:',
                error,
            );

            const message =
                error instanceof Error
                    ? error.message
                    : 'Unable to complete this pickup.';

            Alert.alert(
                'Unable to Complete Pickup',
                message,
            );
        }
    }
  return (
    <Pressable
        style={styles.card}
        onPress={() =>
            router.push({
            pathname: '/pickup-details',
            params: {
                pickupId: pickup.id,
            },
            })
        }
        >
      <Text style={styles.title}>
        Assigned Pickup
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

        {pickup.status === 'accepted' && (
        <Pressable
            style={styles.startButton}
            onPress={handleStart}
        >
            <Text style={styles.startButtonText}>
            Start Pickup
            </Text>
        </Pressable>
        )}

        {pickup.status === 'in_progress' && (
        <Pressable
            style={styles.completeButton}
            onPress={handleComplete}
        >
            <Text style={styles.completeButtonText}>
            Complete Pickup
            </Text>
        </Pressable>
        )}
    </Pressable>
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
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
  },
  startButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#1b5e20',
    },

  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    },

  completeButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#111111',
    },

  completeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
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