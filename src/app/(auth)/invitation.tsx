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
        <Text style={styles.title}>
          You're Invited
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
    backgroundColor: '#f7f9f7',
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
    color: '#555',
  },

  card: {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    elevation: 3,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1b1b1b',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: '#555',
    marginBottom: 28,
  },

  infoSection: {
    marginBottom: 18,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#777',
    marginBottom: 5,
  },

  value: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1b1b1b',
  },

  notice: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: '#555',
  },

button: {
  marginTop: 24,
  height: 54,
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#1b5e20',
},

buttonText: {
  color: '#ffffff',
  fontSize: 16,
  fontWeight: '700',
},
});