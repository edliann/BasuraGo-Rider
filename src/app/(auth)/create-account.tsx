import { useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  login,
} from '../../services/firebase/auth/auth.services';

import {
  createRiderAccountFromInvitation,
} from '../../services/firebase/riders/invitation.services';

export default function CreateAccountScreen() {
  const {
    invitationId,
    invitationToken,
    email,
    phoneNumber,
  } = useLocalSearchParams<{
    invitationId?: string;
    invitationToken?: string;
    email?: string;
    phoneNumber?: string;
  }>();

  const [fullName, setFullName] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  async function handleCreateAccount() {
    if (
      !invitationId ||
      !invitationToken ||
      !email
    ) {
      setError(
        'Your invitation information is missing.',
      );

      return;
    }

    if (!fullName.trim()) {
      setError(
        'Please enter your full name.',
      );

      return;
    }

    if (password.length < 6) {
      setError(
        'Password must be at least 6 characters.',
      );

      return;
    }

    if (
      password !== confirmPassword
    ) {
      setError(
        'Passwords do not match.',
      );

      return;
    }

    try {
    setLoading(true);
    setError('');

    await createRiderAccountFromInvitation({
        invitationId,
        invitationToken,
        fullName,
        password,
    });

    await login(
        email,
        password,
    );

    router.replace('/verification');
    } catch (err: any) {
    console.error(
        'Failed to create rider account:',
        err,
    );

    if (
        err?.code ===
        'functions/already-exists'
    ) {
        setError(
        'An account with this email already exists.',
        );
    } else if (
        err?.code ===
        'functions/failed-precondition'
    ) {
        setError(
        err?.message ||
            'This invitation is no longer available.',
        );
    } else if (
        err?.code ===
        'functions/permission-denied'
    ) {
        setError(
        'This invitation is invalid.',
        );
    } else {
        setError(
        'Unable to create your account. Please try again.',
        );
    }
    } finally {
    setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          BasuraGo
        </Text>

        <Text style={styles.role}>
          RIDER
        </Text>

        <Text style={styles.title}>
          Create Your Account
        </Text>

        <Text style={styles.subtitle}>
          Your invitation has been verified.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>
          Email
        </Text>

        <View style={styles.lockedField}>
          <Text style={styles.lockedText}>
            {email || 'Invitation email'}
          </Text>
        </View>

        <Text style={styles.label}>
          Phone Number
        </Text>

        <View style={styles.lockedField}>
          <Text style={styles.lockedText}>
            {phoneNumber ||
              'Invitation phone number'}
          </Text>
        </View>

        <Text style={styles.label}>
          Full Name
        </Text>

        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
          autoCapitalize="words"
          autoCorrect={false}
          style={styles.input}
        />

        <Text style={styles.label}>
          Password
        </Text>

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Create a password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <Text style={styles.label}>
          Confirm Password
        </Text>

        <TextInput
          value={confirmPassword}
          onChangeText={
            setConfirmPassword
          }
          placeholder="Confirm your password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        {error ? (
          <Text style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Pressable
          style={[
            styles.button,
            loading &&
              styles.buttonDisabled,
          ]}
          onPress={handleCreateAccount}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator
              color="#ffffff"
            />
          ) : (
            <Text style={styles.buttonText}>
              Create Account
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },

  header: {
    alignItems: 'center',
    marginBottom: 30,
  },

  logo: {
    fontSize: 36,
    fontWeight: '700',
  },

  role: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 3,
  },

  title: {
    marginTop: 32,
    fontSize: 27,
    fontWeight: '700',
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#555555',
    textAlign: 'center',
  },

  form: {
    width: '100%',
  },

  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 18,
    fontSize: 16,
  },

  lockedField: {
    height: 52,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    marginBottom: 18,
  },

  lockedText: {
    fontSize: 16,
    color: '#555555',
  },

  error: {
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#b3261e',
  },

  button: {
    height: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1b5e20',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});