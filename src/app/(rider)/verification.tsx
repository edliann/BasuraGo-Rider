import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { useEffect, useState } from 'react';

import {
  getCurrentUser,
  logout,
} from '../../services/firebase/auth/auth.services';

import {
  getRiderApplication,
} from '../../services/firebase/riders/verification.services';

import type {
  RiderApplication,
} from '../../services/firebase/riders/verification.types';

export default function VerificationScreen() {
  const [application, setApplication] =
    useState<RiderApplication | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  useEffect(() => {
    async function loadApplication() {
      try {
        const user = getCurrentUser();

        if (!user) {
          router.replace('/login');
          return;
        }

        const result =
          await getRiderApplication(user.uid);

        setApplication(result);
      } catch (error) {
        console.error(
          'Failed to load rider application:',
          error,
        );

        setError(
          'Unable to load your verification status.',
        );
      } finally {
        setLoading(false);
      }
    }

    loadApplication();
  }, []);

  function handleContinueVerification() {
    if (!application) {
      return;
    }

    if (!application.identityDocumentCompleted) {
      router.push('/government-id');
      return;
    }

    if (!application.driversLicenseCompleted) {
      router.push('/drivers-license');
      return;
    }

    if (!application.faceVerificationCompleted) {
      router.push('/face-verification');
      return;
    }

    if (!application.vehicleInformationCompleted) {
      router.push('/vehicle-information');
      return;
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.message}>
          Loading verification...
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

  if (!application) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          No rider application found.
        </Text>
      </View>
    );
  }

  const requirements = [
    {
      title: 'Basic Information',
      completed:
        application.basicInformationCompleted,
    },
    {
      title: 'Government ID',
      completed:
        application.identityDocumentCompleted,
    },
    {
      title: "Driver's License",
      completed:
        application.driversLicenseCompleted,
    },
    {
      title: 'Face Verification',
      completed:
        application.faceVerificationCompleted,
    },
    {
      title: 'Vehicle Information',
      completed:
        application.vehicleInformationCompleted,
    },
  ];

  const completedRequirements =
    requirements.filter(
      (requirement) =>
        requirement.completed,
    ).length;

  const totalRequirements =
    requirements.length;

  const progressPercentage =
    Math.round(
      (completedRequirements /
        totalRequirements) *
        100,
    );

  const applicationStatus =
    application.status;

  const isApplicationComplete =
    application.basicInformationCompleted === true &&
    application.identityDocumentCompleted === true &&
    application.driversLicenseCompleted === true &&
    application.faceVerificationCompleted === true &&
    application.vehicleInformationCompleted === true;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>
        Rider Verification
      </Text>

      <Text style={styles.subtitle}>
        Complete the requirements below before
        you can operate as a BasuraGo rider.
      </Text>

      {/* Application Status */}

      <View style={styles.applicationStatusCard}>
        <Text style={styles.statusLabel}>
          Application Status
        </Text>

        <Text style={styles.statusValue}>
          {formatStatus(applicationStatus)}
        </Text>
      </View>

      {/* Requirements */}

      <Text style={styles.sectionTitle}>
        Requirements
      </Text>

      <View style={styles.requirementsCard}>
        {requirements.map(
          (requirement, index) => (
            <View
              key={requirement.title}
              style={[
                styles.requirementRow,
                index <
                  requirements.length - 1 &&
                  styles.requirementBorder,
              ]}
            >
              <View
                style={[
                  styles.checkCircle,
                  requirement.completed &&
                    styles.checkCircleCompleted,
                ]}
              >
                <Text
                  style={[
                    styles.checkmark,
                    !requirement.completed &&
                      styles.checkmarkIncomplete,
                  ]}
                >
                  {requirement.completed
                    ? '✓'
                    : '○'}
                </Text>
              </View>

              <Text
                style={styles.requirementTitle}
              >
                {requirement.title}
              </Text>

              <Text
                style={styles.requirementStatus}
              >
                {requirement.completed
                  ? 'Completed'
                  : 'Required'}
              </Text>
            </View>
          ),
        )}
      </View>

      {/* Progress */}

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>
            Verification Progress
          </Text>

          <Text style={styles.progressPercentage}>
            {progressPercentage}%
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPercentage}%`,
              },
            ]}
          />
        </View>

        <Text style={styles.progressText}>
          {completedRequirements} of{' '}
          {totalRequirements} completed
        </Text>
      </View>

      {/* INCOMPLETE */}

      {applicationStatus === 'incomplete' && (
        <>
          {isApplicationComplete ? (
            <View style={styles.completeSection}>
              <View style={styles.completeIcon}>
                <Text
                  style={styles.completeIconText}
                >
                  ✓
                </Text>
              </View>

              <Text style={styles.completeTitle}>
                Verification Complete
              </Text>

              <Text
                style={styles.completeDescription}
              >
                You have completed all required
                verification steps. Your rider
                application is ready to be reviewed
                and submitted.
              </Text>

              <Pressable
                style={styles.primaryButton}
                onPress={() =>
                  router.push(
                    '/review-application',
                  )
                }
              >
                <Text
                  style={styles.primaryButtonText}
                >
                  Review & Submit Application
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.primaryButton}
              onPress={
                handleContinueVerification
              }
            >
              <Text
                style={styles.primaryButtonText}
              >
                Continue Verification
              </Text>
            </Pressable>
          )}
        </>
      )}

      {/* SUBMITTED */}

      {applicationStatus === 'submitted' && (
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Text
              style={styles.statusIconText}
            >
              ✓
            </Text>
          </View>

          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>
              Application Submitted
            </Text>

            <Text
              style={styles.statusDescription}
            >
              Your rider application has been
              successfully submitted. Please wait
              while our team reviews your
              application.
            </Text>
          </View>
        </View>
      )}

      {/* UNDER REVIEW */}

      {applicationStatus ===
        'under_review' && (
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Text
              style={styles.statusIconText}
            >
              ✓
            </Text>
          </View>

          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>
              Application Under Review
            </Text>

            <Text
              style={styles.statusDescription}
            >
              Our team is currently reviewing your
              rider application. You will be
              notified when there is an update.
            </Text>
          </View>
        </View>
      )}

      {/* NEEDS CORRECTION */}

      {applicationStatus ===
        'needs_correction' && (
        <View style={styles.correctionCard}>
          <Text style={styles.correctionTitle}>
            Changes Required
          </Text>

          <Text
            style={styles.correctionDescription}
          >
            Your application needs some
            corrections before it can be approved.
          </Text>

          {application.correctionMessage ? (
            <View
              style={styles.correctionMessage}
            >
              <Text
                style={
                  styles.correctionMessageLabel
                }
              >
                Message from BasuraGo
              </Text>

              <Text
                style={
                  styles.correctionMessageText
                }
              >
                {application.correctionMessage}
              </Text>
            </View>
          ) : null}

          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.push(
                '/review-application',
              )
            }
          >
            <Text
              style={styles.primaryButtonText}
            >
              Review Required Changes
            </Text>
          </Pressable>
        </View>
      )}

      {/* REJECTED */}

      {applicationStatus === 'rejected' && (
        <View style={styles.rejectedCard}>
          <Text style={styles.rejectedTitle}>
            Application Not Approved
          </Text>

          <Text
            style={styles.rejectedDescription}
          >
            Your rider application was not
            approved.
          </Text>

          {application.rejectionReason ? (
            <View
              style={styles.rejectionMessage}
            >
              <Text
                style={
                  styles.rejectionMessageLabel
                }
              >
                Reason
              </Text>

              <Text
                style={
                  styles.rejectionMessageText
                }
              >
                {application.rejectionReason}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* APPROVED */}

      {applicationStatus === 'approved' && (
        <View style={styles.approvedCard}>
          <View style={styles.approvedIcon}>
            <Text
              style={styles.approvedIconText}
            >
              ✓
            </Text>
          </View>

          <Text style={styles.approvedTitle}>
            Application Approved
          </Text>

          <Text
            style={styles.approvedDescription}
          >
            Your rider application has been
            approved. You can now continue to the
            BasuraGo rider dashboard.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.replace('/dashboard')
            }
          >
            <Text
              style={styles.primaryButtonText}
            >
              Go to Dashboard
            </Text>
          </Pressable>
        </View>
      )}

      {/* SIGN OUT */}

      <Pressable
        style={styles.logoutButton}
        onPress={async () => {
          try {
            await logout();

            router.replace('/login');
          } catch (error) {
            console.error(
              'Failed to sign out:',
              error,
            );

            Alert.alert(
              'Sign Out Failed',
              'We could not sign you out. Please try again.',
            );
          }
        }}
      >
        <Text style={styles.logoutButtonText}>
          Sign Out
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function formatStatus(
  status: string,
): string {
  switch (status) {
    case 'incomplete':
      return 'Incomplete';

    case 'submitted':
      return 'Submitted';

    case 'under_review':
      return 'Under Review';

    case 'approved':
      return 'Approved';

    case 'rejected':
      return 'Rejected';

    case 'needs_correction':
      return 'Needs Correction';

    default:
      return status;
  }
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
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },

  applicationStatusCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 14,
    padding: 18,
    marginBottom: 28,
  },

  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },

  statusValue: {
    fontSize: 18,
    fontWeight: '700',
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },

  requirementsCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 14,
    overflow: 'hidden',
  },

  requirementRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  requirementBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },

  checkCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eeeeee',
    marginRight: 12,
  },

  checkCircleCompleted: {
    backgroundColor: '#1b5e20',
  },

  checkmark: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },

  checkmarkIncomplete: {
    color: '#777777',
  },

  requirementTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },

  requirementStatus: {
    fontSize: 12,
    color: '#666666',
  },

  progressSection: {
    marginTop: 20,
    marginBottom: 8,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
  },

  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
  },

  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#eeeeee',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#1b5e20',
  },

  progressText: {
    marginTop: 8,
    fontSize: 13,
    color: '#666666',
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1b5e20',
    paddingHorizontal: 20,
    marginTop: 20,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },

  completeSection: {
    alignItems: 'center',
    marginTop: 24,
  },

  completeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1b5e20',
    marginBottom: 16,
  },

  completeIconText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#ffffff',
  },

  completeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 8,
  },

  completeDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 4,
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#f5f5f5',
    marginTop: 20,
  },

  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1b5e20',
    marginRight: 14,
  },

  statusIconText: {
    fontSize: 21,
    fontWeight: '700',
    color: '#ffffff',
  },

  statusContent: {
    flex: 1,
  },

  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 5,
  },

  statusDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: '#666666',
  },

  correctionCard: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 16,
    padding: 18,
    marginTop: 20,
  },

  correctionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },

  correctionDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: '#666666',
    marginBottom: 16,
  },

  correctionMessage: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f5f5f5',
    marginBottom: 4,
  },

  correctionMessageLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555555',
    marginBottom: 6,
  },

  correctionMessageText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#222222',
  },

  rejectedCard: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 16,
    padding: 18,
    marginTop: 20,
  },

  rejectedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },

  rejectedDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: '#666666',
    marginBottom: 16,
  },

  rejectionMessage: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f5f5f5',
  },

  rejectionMessageLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555555',
    marginBottom: 6,
  },

  rejectionMessageText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#222222',
  },

  approvedCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 16,
    padding: 24,
    marginTop: 20,
  },

  approvedIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1b5e20',
    marginBottom: 16,
  },

  approvedIconText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#ffffff',
  },

  approvedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 8,
  },

  approvedDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666666',
    textAlign: 'center',
  },

  logoutButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },

  logoutButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  message: {
    marginTop: 12,
    fontSize: 16,
  },

  error: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});