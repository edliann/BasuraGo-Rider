import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import {
  getAvailablePickups,
  getMyPickups,
  getPickupHistory,
} from '../../services/firebase/pickups/pickup.services';
import MyPickupCard from '../../components/pickups/MyPickupCard';
import PickupHistoryCard from '../../components/pickups/PickupHistoryCard';
import { updateRiderOnlineStatus } from '../../services/firebase/riders/riders.services';
import type { Pickup } from '../../services/firebase/pickups/pickup.types';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext/AuthContext';
import { logout } from '../../services/firebase/auth/auth.services';
import PickupCard from '../../components/pickups/PickupCard';
import * as Location from 'expo-location';
import {
  saveRiderLocation,
} from '../../services/firebase/riders/location.services';

export default function Dashboard() {
    const {
      rider,
      loading,
    } = useAuth();

    const [pickups, setPickups] =
      useState<Pickup[]>([]);

    const [myPickups, setMyPickups] =
      useState<Pickup[]>([]);

    const [pickupsLoading, setPickupsLoading] =
      useState(true);

    const [myPickupsLoading, setMyPickupsLoading] =
      useState(true);

    const [pickupError, setPickupError] =
      useState('');

    const [myPickupError, setMyPickupError] =
      useState('');

    const [pickupHistory, setPickupHistory] =
      useState<Pickup[]>([]);

    const [historyLoading, setHistoryLoading] =
      useState(true);

    const [historyError, setHistoryError] =
      useState('');

    const [isOnline, setIsOnline] = useState(
      rider?.isOnline ?? false,
    );

    const [onlineStatusLoading, setOnlineStatusLoading] =
      useState(false);

    const [locationTracking, setLocationTracking] =
      useState(false);

    const locationSubscription =
      useRef<Location.LocationSubscription | null>(null);

    useEffect(() => {
      setIsOnline(rider?.isOnline ?? false);
    }, [rider]);

    async function handleOnlineStatusChange() {
      if (!rider) {
        return;
      }

      const nextStatus = !isOnline;

      try {
        setOnlineStatusLoading(true);

        await updateRiderOnlineStatus(
          rider.id,
          nextStatus,
        );

        setIsOnline(nextStatus);

        if (nextStatus) {
          await startLocationTracking();
        } else {
          stopLocationTracking();
        }
      } catch (error) {
        console.error(
          'Failed to update rider online status:',
          error,
        );
      } finally {
        setOnlineStatusLoading(false);
      }
    }

    async function loadPickups() {
      if (!rider) {
        return;
      }

      try {
        setPickupsLoading(true);
        setMyPickupsLoading(true);
        setHistoryLoading(true);

        setPickupError('');
        setMyPickupError('');
        setHistoryError('');

        const [
          availablePickups,
          assignedPickups,
          completedPickups,
        ] = await Promise.all([
          getAvailablePickups(),
          getMyPickups(rider.id),
          getPickupHistory(rider.id),
        ]);

        setPickups(availablePickups);
        setMyPickups(
          assignedPickups.filter(
            (pickup) =>
              pickup.status !== 'completed',
          ),
        );
        setPickupHistory(completedPickups);
      } catch (error) {
        console.error(
          'Failed to load pickups:',
          error,
        );

        setPickupError(
          'Failed to load available pickups.',
        );

        setMyPickupError(
          'Failed to load assigned pickups.',
        );

        setHistoryError(
          'Failed to load pickup history.',
        );
      } finally {
        setPickupsLoading(false);
        setMyPickupsLoading(false);
        setHistoryLoading(false);
      }
    }

    useEffect(() => {
      if (!rider) {
        return;
      }

      loadPickups();
    }, [rider]);

    useEffect(() => {
      return () => {
        if (locationSubscription.current) {
          locationSubscription.current.remove();

          locationSubscription.current = null;
        }
      };
    }, []);

    async function handleGetCurrentLocation() {
      if (!rider) {
        return;
      }

      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          Alert.alert(
            'Location Permission Required',
            'BasuraGo needs your location to provide rider location services.',
          );

          return;
        }

        const location =
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

        const {
          latitude,
          longitude,
          accuracy,
        } = location.coords;

        await saveRiderLocation(
          rider.id,
          latitude,
          longitude,
          accuracy ?? null,
        );

        console.log('Rider location saved:', {
          latitude,
          longitude,
          accuracy,
        });
      } catch (error) {
        console.error(
          'Failed to save rider location:',
          error,
        );

        Alert.alert(
          'Location Error',
          'Unable to save your current location.',
        );
      }
    }

    async function startLocationTracking() {
      if (!rider) {
        return;
      }

      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          Alert.alert(
            'Location Permission Required',
            'BasuraGo needs your location while you are online.',
          );

          return;
        }

        const subscription =
          await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 15000,
              distanceInterval: 25,
            },
            async (location) => {
              const {
                latitude,
                longitude,
                accuracy,
              } = location.coords;

              try {
                await saveRiderLocation(
                  rider.id,
                  latitude,
                  longitude,
                  accuracy ?? null,
                );

                console.log(
                  'Rider location updated:',
                  {
                    latitude,
                    longitude,
                    accuracy,
                  },
                );
              } catch (error) {
                console.error(
                  'Failed to save rider location:',
                  error,
                );
              }
            },
          );

      locationSubscription.current =
        subscription;

      setLocationTracking(true);
      } catch (error) {
        console.error(
          'Failed to start location tracking:',
          error,
        );

        setLocationTracking(false);

        Alert.alert(
          'Location Error',
          'Unable to start location tracking.',
        );

        return null;
      }
    }

    function stopLocationTracking() {
      if (locationSubscription.current) {
        locationSubscription.current.remove();

        locationSubscription.current = null;
      }

      setLocationTracking(false);

      console.log(
        'Rider location tracking stopped.',
      );
    }

    async function handleLogout() {
      try {
        await logout();
        router.replace('/login');
      } catch (error) {
        console.error('Failed to log out:', error);
      }
    }
  

    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="small" />
        </View>
      );
    }

    if (!rider) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorText}>
            Rider profile not available.
          </Text>
        </View>
      );
    }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.logo}>
        BasuraGo
      </Text>

      <Text style={styles.role}>
        RIDER
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>
          Rider Name
        </Text>

        <Text style={styles.value}>
          {rider.fullName}
        </Text>

        <Text style={styles.label}>
          Phone Number
        </Text>

        <Text style={styles.value}>
          {rider.phoneNumber || 'Not provided'}
        </Text>

        <Text style={styles.label}>
          Status
        </Text>

        <Text style={styles.value}>
          {rider.status}
        </Text>

        <Text style={styles.label}>
          Assigned Vehicle
        </Text>

        <Text style={styles.value}>
          {rider.vehicleId || 'No vehicle assigned'}
        </Text>
      </View>
        <View style={styles.onlineStatusCard}>
          <View>
            <Text style={styles.onlineStatusTitle}>
              Rider Status
            </Text>

            <Text style={styles.onlineStatusValue}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>

          <Pressable
            style={[
              styles.onlineStatusButton,
              isOnline &&
                styles.onlineStatusButtonActive,
            ]}
            onPress={handleOnlineStatusChange}
            disabled={onlineStatusLoading}
          >
            <Text style={styles.onlineStatusButtonText}>
              {onlineStatusLoading
                ? 'Updating...'
                : isOnline
                  ? 'Go Offline'
                  : 'Go Online'}
            </Text>
          </Pressable>
        </View>
        <Pressable
          style={styles.locationButton}
          onPress={handleGetCurrentLocation}
        >
          <Text style={styles.locationButtonText}>
            Get Current Location
          </Text>
        </Pressable>
      <View style={styles.pickupsSection}>
        <Text style={styles.sectionTitle}>
          Available Pickups
        </Text>

        {pickupsLoading && (
          <ActivityIndicator
            size="small"
            style={styles.pickupLoader}
          />
        )}

        {!pickupsLoading && pickupError !== '' && (
          <Text style={styles.errorText}>
            {pickupError}
          </Text>
        )}

        {!pickupsLoading &&
          pickupError === '' &&
          pickups.length === 0 && (
            <Text style={styles.emptyText}>
              No available pickups.
            </Text>
          )}

      {pickups.map((pickup) => (
        <PickupCard
          key={pickup.id}
          pickup={pickup}
          riderId={rider.id}
          vehicleId={rider.vehicleId!}
          onAccepted={loadPickups}
        />
      ))}
      </View>
      <View style={styles.myPickupsSection}>
        <Text style={styles.sectionTitle}>
          My Pickups
        </Text>

        {myPickupsLoading && (
          <ActivityIndicator
            size="small"
            style={styles.pickupLoader}
          />
        )}

        {!myPickupsLoading &&
          myPickupError !== '' && (
            <Text style={styles.errorText}>
              {myPickupError}
            </Text>
          )}

        {!myPickupsLoading &&
          myPickupError === '' &&
          myPickups.length === 0 && (
            <Text style={styles.emptyText}>
              No assigned pickups.
            </Text>
          )}

        {!myPickupsLoading &&
          myPickupError === '' &&
          myPickups.map((pickup) => (
            <MyPickupCard
              key={pickup.id}
              pickup={pickup}
              riderId={rider.id}
              onStarted={loadPickups}
            />
          ))}
      </View>
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>
          Pickup History
        </Text>

        {historyLoading && (
          <ActivityIndicator
            size="small"
            style={styles.pickupLoader}
          />
        )}

        {!historyLoading &&
          historyError !== '' && (
            <Text style={styles.errorText}>
              {historyError}
            </Text>
          )}

        {!historyLoading &&
          historyError === '' &&
          pickupHistory.length === 0 && (
            <Text style={styles.emptyText}>
              No completed pickups yet.
            </Text>
          )}

        {!historyLoading &&
          historyError === '' &&
          pickupHistory.map((pickup) => (
            <PickupHistoryCard
              key={pickup.id}
              pickup={pickup}
            />
          ))}
      </View>
      <Pressable
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>
          Sign Out
        </Text>
      </Pressable>
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

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },

  logo: {
    fontSize: 30,
    fontWeight: '700',
  },

  role: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
  },

  card: {
    marginTop: 32,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },

  label: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '600',
  },

  value: {
    marginTop: 4,
    fontSize: 17,
  },

  logoutButton: {
    marginTop: 24,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#111111',
  },

  logoutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  errorText: {
    fontSize: 16,
  },

  myPickupsSection: {
    marginTop: 16,
  },

  pickupsSection: {
    marginTop: 32,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },

  pickupLoader: {
    marginTop: 8,
  },

  emptyText: {
    fontSize: 15,
  },

  pickupItem: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },

  pickupId: {
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '700',
  },

  historySection: {
    marginTop: 16,
  },

onlineStatusCard: {
  marginBottom: 24,
  padding: 18,
  borderRadius: 16,
  backgroundColor: '#f5f5f5',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},

onlineStatusTitle: {
  fontSize: 12,
  fontWeight: '600',
},

onlineStatusValue: {
  marginTop: 4,
  fontSize: 18,
  fontWeight: '700',
},

onlineStatusButton: {
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#1b5e20',
},

onlineStatusButtonActive: {
  backgroundColor: '#1b5e20',
},

onlineStatusButtonText: {
  fontSize: 14,
  fontWeight: '700',
},

locationButton: {
  marginBottom: 24,
  paddingVertical: 14,
  borderRadius: 10,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#1b5e20',
},

locationButtonText: {
  fontSize: 16,
  fontWeight: '700',
  color: '#1b5e20',
},
});