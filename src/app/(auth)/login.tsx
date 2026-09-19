import {
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  login,
} from '../../services/firebase/auth/auth.services';

import {
  Redirect, router
} from 'expo-router';

import {
  useAuth,
} from '../../contexts/AuthContext/AuthContext';

import { TEST_INVITATION } from '../../utils/invitation-test';

export default function Login() {
  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const {
    rider,
    application,
    user,
    loading: authLoading,
  } = useAuth();

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError(
        'Please enter your email and password.',
      );

      return;
    }

    try {
      setLoading(true);
      setError('');

        await login(
        email,
        password,
        );

        // AuthContext will now detect
        // whether this account is an active rider.

    } catch (err) {
      console.error(
        'Rider login failed:',
        err,
      );

      setError(
        'Invalid email or password.',
      );
    } finally {
      setLoading(false);
    }
  }
    if (!authLoading && user) {
      if (rider) {
        return <Redirect href="/dashboard" />;
      }

      if (application) {
        return <Redirect href="/verification" />;
      }

      return <Redirect href="/access-denied" />;
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
          Welcome Back
        </Text>

        <Text style={styles.subtitle}>
          Sign in to continue.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>
          Email
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={styles.input}
        />

        <Text style={styles.label}>
          Password
        </Text>

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
          autoCapitalize="none"
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
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator
              color="#ffffff"
            />
          ) : (
            <Text style={styles.buttonText}>
              Sign In
            </Text>
          )}
        </Pressable>
        <View style={styles.signUpRow}>
          <Text style={styles.signUpText}>
            Don't have an account?
          </Text>

          <Pressable
            onPress={() => router.push('/signup')}
          >
            <Text style={styles.link}>
              Sign Up
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.testInvitationButton}
          onPress={() => {
            router.push({
              pathname: '/invitation',
              params: {
                invitationId:
                  TEST_INVITATION.invitationId,
                invitationToken:
                  TEST_INVITATION.invitationToken,
              },
            });
          }}
        >
          <Text style={styles.testInvitationButtonText}>
            Test Invitation
          </Text>
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
    marginBottom: 40,
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
    marginTop: 40,
    fontSize: 28,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 16,
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
    marginBottom: 20,
    fontSize: 16,
  },

  error: {
    marginBottom: 16,
    fontSize: 14,
    textAlign: 'center',
  },

  button: {
    height: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

signUpRow: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 5,
  marginTop: 24,
},

signUpText: {
  fontSize: 14,
},

link: {
  color: '#1b5e20',
  fontWeight: '700',
},

  testInvitationButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1b5e20',
    borderRadius: 10,
  },

  testInvitationButtonText: {
    color: '#1b5e20',
    fontSize: 14,
    fontWeight: '700',
  },
});