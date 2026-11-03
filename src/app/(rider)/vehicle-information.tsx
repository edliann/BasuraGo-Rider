import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  const parentRoute = returnTo === '/review-application'
    || returnTo === '/account'
    || returnTo === '/settings'
    ? returnTo
    : '/verification';
  const parentLabel = parentRoute === '/account'
    ? 'Account'
    : parentRoute === '/settings'
      ? 'Settings'
      : parentRoute === '/review-application'
        ? 'Application Review'
        : 'Verification';

  function handleBackToParent() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(parentRoute);
  }

  const loadExistingVehicleInformation = useCallback(async () => {
    const user = getCurrentUser();
    if (!user) {
      router.replace('/login');
      setLoading(false);
      return;
    }

    try {
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
  }, [router]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        return loadExistingVehicleInformation();
      }
    });
    return () => {
      active = false;
    };
  }, [loadExistingVehicleInformation]);

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
              handleBackToParent();
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
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
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
        onPress={handleBackToParent}
        disabled={saving}
      >
        <Text style={styles.backButtonText}>
          Back to {parentLabel}
        </Text>
      </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: '#F5F8F6',
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
    backgroundColor: '#F5F8F6',
  },

  header: {
    marginBottom: 28,
  },

  stepText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#64736A',
    textAlign: 'center',
    marginBottom: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#173D2C',
    textAlign: 'center',
    marginBottom: 10,
  },

  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64736A',
    textAlign: 'center',
  },

  section: {
    marginBottom: 20,
  },

  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#173D2C',
    marginBottom: 8,
  },

  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#DCE8DE',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#173D2C',
    backgroundColor: '#FAFCFA',
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
    borderColor: '#DCE8DE',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  vehicleOptionSelected: {
    borderColor: '#176744',
    backgroundColor: '#176744',
  },

  vehicleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64736A',
  },

  vehicleOptionTextSelected: {
    color: '#fff',
  },

  infoBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EFF8F1',
    marginBottom: 24,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#173D2C',
    marginBottom: 5,
  },

  infoText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64736A',
  },

  primaryButton: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: '#176744',
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
    color: '#64736A',
  },

  loadingText: {
    fontSize: 16,
    color: '#64736A',
  },
});
