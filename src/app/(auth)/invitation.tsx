import {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Pressable,
  Text,
  View,
} from 'react-native';

import {
  useLocalSearchParams,
  router,
} from 'expo-router';

import {
  getRiderInvitation,
  type GetRiderInvitationResult,
} from '../../services/firebase/riders/invitation.services';

export default function InvitationScreen() {
  const {
    invitationId,
    invitationToken,
  } = useLocalSearchParams<{
    invitationId?: string;
    invitationToken?: string;
  }>();

  const [loading, setLoading] =
    useState(true);

  const [invitation, setInvitation] =
    useState<GetRiderInvitationResult | null>(
      null,
    );

  useEffect(() => {
    async function validateInvitation() {
      if (
        !invitationId ||
        !invitationToken
      ) {
        setLoading(false);

        Alert.alert(
          'Invalid Invitation',
          'The invitation link is missing required information.',
          [
            {
              text: 'OK',
              onPress: () =>
                router.replace('/login'),
            },
          ],
        );

        return;
      }

      try {
        const result =
          await getRiderInvitation(
            invitationId,
            invitationToken,
          );

        setInvitation(result);
      } catch (error: any) {
        console.error(
            'Failed to validate rider invitation:',
            error,
        );

        Alert.alert(
            'Invitation Error',
            `${error?.code ?? 'unknown'}\n\n${
            error?.message ?? 'Unknown error'
            }`,
            [
            {
                text: 'OK',
                onPress: () =>
                router.replace('/login'),
            },
            ],
        );
        } finally {
        setLoading(false);
      }
    }

    validateInvitation();
  }, [
    invitationId,
    invitationToken,
  ]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Validating your invitation...
        </Text>
      </View>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
          onPress={() => router.replace('/login')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>‹  Back to Sign In</Text>
        </Pressable>
        <Text style={styles.title}>
          You&apos;re Invited
        </Text>

        <Text style={styles.subtitle}>
          You have been invited to become a
          BasuraGo Rider.
        </Text>

        <View style={styles.infoSection}>
          <Text style={styles.label}>
            Email
          </Text>

          <Text style={styles.value}>
            {invitation.email}
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.label}>
            Phone Number
          </Text>

          <Text style={styles.value}>
            {invitation.phoneNumber}
          </Text>
        </View>

        <Text style={styles.notice}>
          This invitation is valid. Continue
          to create your BasuraGo Rider account.
        </Text>

        <Pressable
        style={styles.button}
        onPress={() => {
            router.push({
            pathname: '/create-account',
            params: {
                invitationId:
                invitation.invitationId,

                invitationToken:
                invitationToken,

                email:
                invitation.email,

                phoneNumber:
                invitation.phoneNumber,
            },
            });
        }}
        >
        <Text style={styles.buttonText}>
            Accept Invitation
        </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F5F8F6',
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64736A',
  },

  card: {
    width: '100%',
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DCE8DE',
    backgroundColor: '#FFFFFF',
    elevation: 3,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#173D2C',
    marginBottom: 10,
  },

  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: 18,
  },

  backButtonText: {
    color: '#176744',
    fontSize: 14,
    fontWeight: '700',
  },

  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: '#64736A',
    marginBottom: 28,
  },

  infoSection: {
    marginBottom: 18,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64736A',
    marginBottom: 5,
  },

  value: {
    fontSize: 16,
    fontWeight: '500',
    color: '#173D2C',
  },

  notice: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: '#64736A',
  },

button: {
  marginTop: 24,
  height: 54,
  borderRadius: 14,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#176744',
},

buttonText: {
  color: '#ffffff',
  fontSize: 16,
  fontWeight: '700',
},
});
