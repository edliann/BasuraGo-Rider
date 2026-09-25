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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

import { getCurrentUser } from '../../services/firebase/auth/auth.services';
import {
  getRiderApplication,
  submitRiderApplication,
} from '../../services/firebase/riders/verification.services';
import type { RiderApplication } from '../../services/firebase/riders/verification.types';
import app from '../../services/firebase/firebase';

type UserProfile = {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
};

export default function ReviewApplicationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ correction?: string }>();

  const [application, setApplication] = useState<RiderApplication | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const riderId = getCurrentUser()?.uid ?? '';

  const loadApplication = async () => {
    if (!riderId) {
      setLoading(false);
      return;
    }

    try {
      const db = getFirestore(app);

      const [applicationData, userSnapshot] = await Promise.all([
        getRiderApplication(riderId),
        getDoc(doc(db, 'users', riderId)),
      ]);

      setApplication(applicationData);

      if (userSnapshot.exists()) {
        setProfile(userSnapshot.data() as UserProfile);
      }
    } catch (error) {
      console.error('Failed to load review application:', error);
      Alert.alert(
        'Unable to Load',
        'We could not load your application. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApplication();
  }, [riderId]);

  const handleSubmit = async () => {
    if (!riderId || !application) {
      return;
    }

    try {
      setSubmitting(true);

      await submitRiderApplication(riderId);

      Alert.alert(
        'Application Submitted',
        'Your corrected application has been submitted for review.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/verification'),
          },
        ],
      );
    } catch (error) {
      console.error('Failed to submit application:', error);

      Alert.alert(
        'Unable to Submit',
        error instanceof Error
          ? error.message
          : 'Please complete all required verification steps before submitting.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading application...</Text>
      </View>
    );
  }

  if (!application) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Application Not Found</Text>
        <Text style={styles.errorText}>
          We could not find your rider application.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace('/verification')}
        >
          <Text style={styles.primaryButtonText}>Back to Verification</Text>
        </Pressable>
      </View>
    );
  }

  const needsCorrection = application.status === 'needs_correction';

  const completedCount = [
    application.basicInformationCompleted,
    application.identityDocumentCompleted,
    application.driversLicenseCompleted,
    application.faceVerificationCompleted,
    application.vehicleInformationCompleted,
  ].filter(Boolean).length;

  const isComplete = completedCount === 5;

  const openGovernmentId = () => {
    router.push({
      pathname: '/government-id',
      params: { returnTo: '/review-application' },
    });
  };

  const openDriversLicense = () => {
    router.push({
      pathname: '/drivers-license',
      params: { returnTo: '/review-application' },
    });
  };

  const openFaceVerification = () => {
    router.push({
      pathname: '/face-verification',
      params: { returnTo: '/review-application' },
    });
  };

  const openVehicleInformation = () => {
    router.push({
      pathname: '/vehicle-information',
      params: { returnTo: '/review-application' },
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>
        {needsCorrection ? 'Review Required Changes' : 'Review Application'}
      </Text>

      <Text style={styles.subtitle}>
        {needsCorrection
          ? 'Please review the correction requested by the administrator and update the necessary information before resubmitting.'
          : 'Review your information before submitting your rider application.'}
      </Text>

      {needsCorrection && application.correctionMessage ? (
        <View style={styles.correctionCard}>
          <Text style={styles.correctionLabel}>ADMINISTRATOR MESSAGE</Text>
          <Text style={styles.correctionTitle}>Changes Required</Text>
          <Text style={styles.correctionMessage}>
            {application.correctionMessage}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Rider Information</Text>

        <InfoRow
          label="Full Name"
          value={profile?.fullName || 'Not provided'}
        />

        <InfoRow
          label="Email"
          value={profile?.email || 'Not provided'}
        />

        <InfoRow
          label="Phone"
          value={profile?.phoneNumber || 'Not provided'}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Verification</Text>
            <Text style={styles.progressText}>
              {completedCount}/5 completed
            </Text>
          </View>
        </View>

        <VerificationRow
          label="Basic Information"
          completed={application.basicInformationCompleted}
        />

        <VerificationRow
          label="Government ID"
          completed={application.identityDocumentCompleted}
          actionLabel={needsCorrection ? 'Edit / Retake' : undefined}
          onAction={needsCorrection ? openGovernmentId : undefined}
        />

        <VerificationRow
          label="Driver's License"
          completed={application.driversLicenseCompleted}
          actionLabel={needsCorrection ? 'Edit / Retake' : undefined}
          onAction={needsCorrection ? openDriversLicense : undefined}
        />

        <VerificationRow
          label="Face Verification"
          completed={application.faceVerificationCompleted}
          actionLabel={needsCorrection ? 'Retake' : undefined}
          onAction={needsCorrection ? openFaceVerification : undefined}
        />

        <VerificationRow
          label="Vehicle Information"
          completed={application.vehicleInformationCompleted}
          actionLabel={needsCorrection ? 'Edit' : undefined}
          onAction={needsCorrection ? openVehicleInformation : undefined}
        />
      </View>

      {application.vehicleInformation ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>

          <InfoRow
            label="Vehicle Type"
            value={
              application.vehicleInformation.vehicleType ||
              'Not provided'
            }
          />

          <InfoRow
            label="Plate Number"
            value={
              application.vehicleInformation.plateNumber ||
              'Not provided'
            }
          />
        </View>
      ) : null}

      <View
        style={[
          styles.statusCard,
          needsCorrection && styles.correctionStatusCard,
        ]}
      >
        <Text style={styles.statusTitle}>
          {needsCorrection
            ? 'Correction Required'
            : application.status === 'submitted'
              ? 'Application Submitted'
              : 'Ready for Submission'}
        </Text>

        <Text style={styles.statusText}>
          {needsCorrection
            ? 'Update the requested information above, then submit your corrected application.'
            : application.status === 'submitted'
              ? 'Your application is currently waiting for administrator review.'
              : isComplete
                ? 'All required verification steps have been completed. Your application can now be submitted for review.'
                : 'Complete all required verification steps before submitting.'}
        </Text>
      </View>

      {application.status === 'incomplete' || needsCorrection ? (
        <Pressable
          style={[
            styles.primaryButton,
            (!isComplete || submitting) && styles.disabledButton,
          ]}
          disabled={!isComplete || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {needsCorrection
                ? 'Submit Corrected Application'
                : 'Submit Application'}
            </Text>
          )}
        </Pressable>
      ) : null}

      <Pressable
        style={styles.secondaryButton}
        onPress={() => router.replace('/verification')}
      >
        <Text style={styles.secondaryButtonText}>
          Back to Verification
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function VerificationRow({
  label,
  completed,
  actionLabel,
  onAction,
}: {
  label: string;
  completed: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.verificationRow}>
      <View style={styles.verificationMain}>
        <View
          style={[
            styles.statusDot,
            completed ? styles.completedDot : styles.incompleteDot,
          ]}
        />

        <Text style={styles.verificationLabel}>{label}</Text>
      </View>

      <View style={styles.verificationActions}>
        <Text
          style={[
            styles.verificationStatus,
            completed
              ? styles.completedText
              : styles.incompleteText,
          ]}
        >
          {completed ? 'Completed' : 'Incomplete'}
        </Text>

        {actionLabel && onAction ? (
          <Pressable
            style={styles.editButton}
            onPress={onAction}
          >
            <Text style={styles.editButtonText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 12,
    color: '#667085',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#101828',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
    color: '#667085',
  },
  correctionCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  correctionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#c2410c',
  },
  correctionTitle: {
    marginTop: 5,
    fontSize: 18,
    fontWeight: '700',
    color: '#9a3412',
  },
  correctionMessage: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#7c2d12',
  },
  card: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eaecf0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 12,
  },
  progressText: {
    marginTop: -7,
    marginBottom: 12,
    fontSize: 13,
    color: '#667085',
  },
  infoRow: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f7',
  },
  infoLabel: {
    fontSize: 12,
    color: '#667085',
  },
  infoValue: {
    marginTop: 3,
    fontSize: 15,
    color: '#101828',
    fontWeight: '500',
  },
  verificationRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f7',
  },
  verificationMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  completedDot: {
    backgroundColor: '#16a34a',
  },
  incompleteDot: {
    backgroundColor: '#98a2b3',
  },
  verificationLabel: {
    fontSize: 14,
    color: '#101828',
  },
  verificationActions: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  verificationStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  completedText: {
    color: '#15803d',
  },
  incompleteText: {
    color: '#667085',
  },
  editButton: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#eef4ff',
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#175cd3',
  },
  statusCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#ecfdf3',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  correctionStatusCard: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#101828',
  },
  statusText: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 21,
    color: '#475467',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
  },
  disabledButton: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 12,
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d0d5dd',
  },
  secondaryButtonText: {
    color: '#344054',
    fontSize: 15,
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#101828',
  },
  errorText: {
    marginTop: 8,
    marginBottom: 20,
    textAlign: 'center',
    color: '#667085',
  },
});