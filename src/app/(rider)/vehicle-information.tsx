import {
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useRouter,
  useLocalSearchParams
} from 'expo-router';

import {
  getCurrentUser,
} from '../../services/firebase/auth/auth.services';

import {
  getRiderApplication,
} from '../../services/firebase/riders/verification.services';

import {
  saveVehicleInformation,
} from '../../services/firebase/riders/vehicle-application.services';

import type {
  RiderVehicleType,
} from '../../services/firebase/riders/vehicle-application.types';

const VEHICLE_TYPES: {
  label: string;
  value: RiderVehicleType;
}[] = [
  {
    label: 'Motorcycle',
    value: 'motorcycle',
  },
  {
    label: 'Tricycle',
    value: 'tricycle',
  },
  {
    label: 'Van',
    value: 'van',
  },
  {
    label: 'Truck',
    value: 'truck',
  },
  {
    label: 'Other',
    value: 'other',
  },
];

export default function VehicleInformationScreen() {
  const router = useRouter();

  const [vehicleType, setVehicleType] =
    useState<RiderVehicleType | null>(null);

  const [make, setMake] =
    useState('');

  const [model, setModel] =
    useState('');

  const [color, setColor] =
    useState('');

  const [plateNumber, setPlateNumber] =
    useState('');

  const [registrationNumber, setRegistrationNumber] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);
  
  const { returnTo } = useLocalSearchParams<{
    returnTo?: string;
  }>();

  useEffect(() => {
    loadExistingVehicleInformation();
  }, []);

  async function loadExistingVehicleInformation() {
    try {
      const user = getCurrentUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const application =
        await getRiderApplication(
          user.uid,
        );

      if (!application) {
        Alert.alert(
          'Application Not Found',
          'We could not find your rider application.',
        );

        router.replace('/verification');
        return;
      }

      const existingVehicle =
        application.vehicleInformation;

      if (existingVehicle) {
        setVehicleType(
          existingVehicle.vehicleType ?? null,
        );

        setMake(
          existingVehicle.make ?? '',
        );

        setModel(
          existingVehicle.model ?? '',
        );

        setColor(
          existingVehicle.color ?? '',
        );

        setPlateNumber(
          existingVehicle.plateNumber ?? '',
        );

        setRegistrationNumber(
          existingVehicle.registrationNumber ?? '',
        );
      }
    } catch (error) {
      console.error(
        'Failed to load vehicle information:',
        error,
      );

      Alert.alert(
        'Unable to Load',
        'We could not load your vehicle information.',
      );
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): string | null {
    if (!vehicleType) {
      return 'Please select your vehicle type.';
    }

    if (!make.trim()) {
      return 'Please enter the vehicle make.';
    }

    if (!model.trim()) {
      return 'Please enter the vehicle model.';
    }

    if (!color.trim()) {
      return 'Please enter the vehicle color.';
    }

    if (!plateNumber.trim()) {
      return 'Please enter the plate number.';
    }

    if (!registrationNumber.trim()) {
      return 'Please enter the registration number.';
    }

    return null;
  }

  async function handleSave() {
    const user = getCurrentUser();

    if (!user) {
      router.replace('/login');
      return;
    }

    const validationError =
      validateForm();

    if (validationError) {
      Alert.alert(
        'Incomplete Information',
        validationError,
      );
      return;
    }

    if (!vehicleType) {
      return;
    }

    try {
      setSaving(true);

      await saveVehicleInformation(
        user.uid,
        {
          vehicleType,
          make: make.trim(),
          model: model.trim(),
          color: color.trim(),
          plateNumber:
            plateNumber.trim().toUpperCase(),
          registrationNumber:
            registrationNumber
              .trim()
              .toUpperCase(),
        },
      );

      Alert.alert(
        'Vehicle Information Saved',
        'Your vehicle information has been saved successfully.',
        [
          {
            text: 'Continue',
            onPress: () => {
              router.replace(
                returnTo === '/review-application'
                  ? '/review-application'
                  : '/verification',
              );
            },
          },
        ],
      );
    } catch (error) {
      console.error(
        'Failed to save vehicle information:',
        error,
      );

      Alert.alert(
        'Save Failed',
        'We could not save your vehicle information. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>
          Loading vehicle information...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.stepText}>
          RIDER VERIFICATION
        </Text>

        <Text style={styles.title}>
          Vehicle Information
        </Text>

        <Text style={styles.description}>
          Provide accurate information about
          the vehicle you will use for BasuraGo
          pickups.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>
          Vehicle Type
        </Text>

        <View style={styles.vehicleTypes}>
          {VEHICLE_TYPES.map((type) => {
            const selected =
              vehicleType === type.value;

            return (
              <Pressable
                key={type.value}
                style={[
                  styles.vehicleOption,
                  selected &&
                    styles.vehicleOptionSelected,
                ]}
                onPress={() =>
                  setVehicleType(
                    type.value,
                  )
                }
                disabled={saving}
              >
                <Text
                  style={[
                    styles.vehicleOptionText,
                    selected &&
                      styles.vehicleOptionTextSelected,
                  ]}
                >
                  {type.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>
          Vehicle Make
        </Text>

        <TextInput
          style={styles.input}
          value={make}
          onChangeText={setMake}
          placeholder="e.g. Honda"
          placeholderTextColor="#999"
          autoCapitalize="words"
          editable={!saving}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>
          Vehicle Model
        </Text>

        <TextInput
          style={styles.input}
          value={model}
          onChangeText={setModel}
          placeholder="e.g. TMX 125"
          placeholderTextColor="#999"
          autoCapitalize="words"
          editable={!saving}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>
          Color
        </Text>

        <TextInput
          style={styles.input}
          value={color}
          onChangeText={setColor}
          placeholder="e.g. Black"
          placeholderTextColor="#999"
          autoCapitalize="words"
          editable={!saving}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>
          Plate Number
        </Text>

        <TextInput
          style={styles.input}
          value={plateNumber}
          onChangeText={setPlateNumber}
          placeholder="e.g. ABC 1234"
          placeholderTextColor="#999"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!saving}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>
          Registration Number
        </Text>

        <TextInput
          style={styles.input}
          value={registrationNumber}
          onChangeText={
            setRegistrationNumber
          }
          placeholder="Enter registration number"
          placeholderTextColor="#999"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!saving}
        />
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>
          Important
        </Text>

        <Text style={styles.infoText}>
          Make sure the information matches
          your vehicle documents. Your vehicle
          information may be reviewed before
          your rider application is approved.
        </Text>
      </View>

      <Pressable
        style={[
          styles.primaryButton,
          saving &&
            styles.primaryButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>
          {saving
            ? 'Saving...'
            : 'Save & Continue'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.backButton}
        onPress={() =>
          router.replace('/verification')
        }
        disabled={saving}
      >
        <Text style={styles.backButtonText}>
          Back to Verification
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },

  header: {
    marginBottom: 28,
  },

  stepText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 10,
  },

  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666',
    textAlign: 'center',
  },

  section: {
    marginBottom: 20,
  },

  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    marginBottom: 8,
  },

  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#d5d5d5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
  },

  vehicleTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  vehicleOption: {
    minWidth: '30%',
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#d5d5d5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },

  vehicleOptionSelected: {
    borderColor: '#111',
    backgroundColor: '#111',
  },

  vehicleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
  },

  vehicleOptionTextSelected: {
    color: '#fff',
  },

  infoBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    marginBottom: 24,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
    marginBottom: 5,
  },

  infoText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#666',
  },

  primaryButton: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  primaryButtonDisabled: {
    opacity: 0.5,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  backButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },

  loadingText: {
    fontSize: 16,
    color: '#555',
  },
});