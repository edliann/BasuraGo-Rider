import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useRouter } from 'expo-router';

import {
  doc,
  getDoc,
  getFirestore,
} from 'firebase/firestore';

import {
  getCurrentUser,
} from '../../services/firebase/auth/auth.services';

import {
  getRiderApplication,
  submitRiderApplication,
} from '../../services/firebase/riders/verification.services';

import type {
  RiderApplication,
} from '../../services/firebase/riders/verification.types';

import app from '../../services/firebase/firebase';

const db = getFirestore(app);

interface UserProfile {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
}

export default function ReviewApplicationScreen() {
  const router = useRouter();

    const [userProfile, setUserProfile] =
    useState<UserProfile | null>(null);

    const [application, setApplication] =
    useState<RiderApplication | null>(null);

    const [loading, setLoading] =
    useState(true);

    const [submitting, setSubmitting] =
    useState(false);

  useEffect(() => {
    loadApplication();
  }, []);

    async function loadApplication() {
    try {
        const user = getCurrentUser();

        if (!user) {
        router.replace('/login');
        return;
        }

        const userRef = doc(
        db,
        'users',
        user.uid,
        );

        const userSnapshot =
        await getDoc(userRef);

        if (userSnapshot.exists()) {
        setUserProfile(
            userSnapshot.data() as UserProfile,
        );
        }

        const riderApplication =
        await getRiderApplication(user.uid);

        setApplication(riderApplication);
    } catch (error) {
        console.error(
        'Failed to load rider application:',
        error,
        );

        Alert.alert(
        'Unable to Load Application',
        'We could not load your application. Please try again.',
        );
    } finally {
        setLoading(false);
    }
    }

    async function handleSubmitApplication() {
    const user = getCurrentUser();

    if (!user) {
        router.replace('/login');
        return;
    }

    if (!application) {
        return;
    }

    try {
        setSubmitting(true);

        await submitRiderApplication(user.uid);

        Alert.alert(
        'Application Submitted',
        'Your rider application has been submitted successfully and is now waiting for review.',
        [
            {
            text: 'OK',
            onPress: () => {
                router.replace('/verification');
            },
            },
        ],
        );
    } catch (error) {
        console.error(
        'Failed to submit rider application:',
        error,
        );

        Alert.alert(
        'Submission Failed',
        'We could not submit your application. Please try again.',
        );
    } finally {
        setSubmitting(false);
    }
    }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading your application...
        </Text>
      </View>
    );
  }

  if (!application) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>
          Application Not Found
        </Text>

        <Text style={styles.emptyDescription}>
          We could not find your rider application.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.replace('/verification')
          }
        >
          <Text style={styles.primaryButtonText}>
            Back to Verification
          </Text>
        </Pressable>
      </View>
    );
  }

  const vehicle =
    application.vehicleInformation;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            Review Application
          </Text>

          <Text style={styles.subtitle}>
            Please review your information before
            submitting your rider application.
          </Text>
        </View>

        {/* Rider Information */}

        <View style={styles.section}>
        <Text style={styles.sectionTitle}>
            Rider Information
        </Text>

        <InfoRow
            label="Full Name"
            value={
            userProfile?.fullName ||
            getCurrentUser()?.displayName
            }
        />

        <InfoRow
            label="Email"
            value={
            userProfile?.email ||
            getCurrentUser()?.email
            }
        />

        <InfoRow
            label="Phone Number"
            value={
            userProfile?.phoneNumber
            }
        />
        </View>

        {/* Verification Requirements */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Verification Requirements
          </Text>

          <VerificationRow
            label="Basic Information"
            completed={
              application.basicInformationCompleted
            }
          />

          <VerificationRow
            label="Government ID"
            completed={
              application.identityDocumentCompleted
            }
          />

          <VerificationRow
            label="Driver's License"
            completed={
              application.driversLicenseCompleted
            }
          />

          <VerificationRow
            label="Face Verification"
            completed={
              application.faceVerificationCompleted
            }
          />

          <VerificationRow
            label="Vehicle Information"
            completed={
              application.vehicleInformationCompleted
            }
          />
        </View>

        {/* Vehicle Information */}

        {vehicle && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Vehicle Information
            </Text>

            <InfoRow
              label="Vehicle Type"
              value={formatVehicleType(
                vehicle.vehicleType,
              )}
            />

            <InfoRow
              label="Make"
              value={vehicle.make}
            />

            <InfoRow
              label="Model"
              value={vehicle.model}
            />

            <InfoRow
              label="Color"
              value={vehicle.color}
            />

            <InfoRow
              label="Plate Number"
              value={vehicle.plateNumber}
            />

            <InfoRow
              label="Registration Number"
              value={
                vehicle.registrationNumber
              }
            />
          </View>
        )}

        {/* Application Status */}

        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Text style={styles.statusIconText}>
              ✓
            </Text>
          </View>

          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>
              Ready for Submission
            </Text>

            <Text style={styles.statusDescription}>
              All required verification steps have
              been completed. Your application can
              now be submitted for review.
            </Text>
          </View>
        </View>

        {/* Submit */}

        <Pressable
        style={[
            styles.primaryButton,
            submitting && styles.buttonDisabled,
        ]}
        onPress={() => {
            Alert.alert(
            'Submit Application',
            'Are you sure you want to submit your rider application for review?',
            [
                {
                text: 'Cancel',
                style: 'cancel',
                },
                {
                text: 'Submit',
                onPress: handleSubmitApplication,
                },
            ],
            );
        }}
        disabled={submitting}
        >
        <Text style={styles.primaryButtonText}>
            {submitting
            ? 'Submitting...'
            : 'Submit Application'}
        </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            router.replace('/verification')
          }
        >
          <Text style={styles.secondaryButtonText}>
            Back to Verification
          </Text>
        </Pressable>

        <Text style={styles.footerText}>
          By submitting your application, you confirm
          that the information you provided is accurate
          and complete.
        </Text>
      </ScrollView>
    </View>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | undefined | null;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {value || 'Not provided'}
      </Text>
    </View>
  );
}

function VerificationRow({
  label,
  completed,
}: {
  label: string;
  completed: boolean;
}) {
  return (
    <View style={styles.verificationRow}>
      <View
        style={[
          styles.checkCircle,
          !completed &&
            styles.checkCircleIncomplete,
        ]}
      >
        <Text
          style={[
            styles.checkText,
            !completed &&
              styles.checkTextIncomplete,
          ]}
        >
          {completed ? '✓' : '•'}
        </Text>
      </View>

      <Text style={styles.verificationLabel}>
        {label}
      </Text>

      <Text style={styles.verificationStatus}>
        {completed
          ? 'Completed'
          : 'Incomplete'}
      </Text>
    </View>
  );
}

function formatVehicleType(
  vehicleType: string,
): string {
  switch (vehicleType) {
    case 'motorcycle':
      return 'Motorcycle';

    case 'tricycle':
      return 'Tricycle';

    case 'van':
      return 'Van';

    case 'truck':
      return 'Truck';

    case 'other':
      return 'Other';

    default:
      return vehicleType;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },

  emptyDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },

  header: {
    marginBottom: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666',
  },

  section: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    backgroundColor: '#fff',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
  },

  infoRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  infoLabel: {
    fontSize: 13,
    color: '#777',
    marginBottom: 4,
  },

  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
  },

  verificationRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    marginRight: 12,
  },

  checkCircleIncomplete: {
    backgroundColor: '#eee',
  },

  checkText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  checkTextIncomplete: {
    color: '#999',
  },

  verificationLabel: {
    flex: 1,
    fontSize: 15,
    color: '#222',
  },

  verificationStatus: {
    fontSize: 13,
    color: '#777',
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#f5f5f5',
    marginBottom: 20,
  },

  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    marginRight: 14,
  },

  statusIconText: {
    fontSize: 21,
    fontWeight: '700',
    color: '#fff',
  },

  statusContent: {
    flex: 1,
  },

  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 5,
  },

  statusDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: '#666',
  },

  primaryButton: {
    minHeight: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#111',
    marginBottom: 12,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  secondaryButton: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },

  footerText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#888',
    textAlign: 'center',
    marginTop: 18,
  },

  buttonDisabled: {
    opacity: 0.6,
  },
});