import {
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RemixIcon from 'react-native-remix-icon';

import {
  login,
  resetPassword,
} from '../../services/firebase/auth/auth.services';

import {
  Redirect,
} from 'expo-router';

import {
  useAuth,
} from '../../contexts/AuthContext/AuthContext';

export default function Login() {
  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');
  const loginInProgress = useRef(false);

  const {
    rider,
    application,
    user,
    authInitializationFailed,
    loading: authLoading,
  } = useAuth();

  async function handleLogin() {
    if (
      loginInProgress.current ||
      authLoading ||
      authInitializationFailed
    ) {
      return;
    }

    if (!email.trim() || !password) {
      setError(
        'Please enter your email and password.',
      );

      return;
    }

    try {
      loginInProgress.current = true;
      setLoading(true);
      setError('');

      await login(
        email,
        password,
      );
    } catch (err) {
      console.error(
        'Rider login failed:',
        err,
      );

      setError(getLoginErrorMessage(err));
    } finally {
      loginInProgress.current = false;
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

  async function handleForgotPassword() {
    if (authLoading || authInitializationFailed) return;

    if (!email.trim()) {
      setError('Please enter your email address first.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await resetPassword(email.trim());

      alert(
        'Password reset email sent. Check your inbox and follow the instructions.'
      );
    } catch (err) {
      console.error('Password reset failed:', err);

      setError(
        'Unable to send the reset email. Check your email address and try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  const isBusy =
    loading || authLoading || authInitializationFailed;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
        >
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

        <View style={[styles.input, styles.passwordInputContainer]}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            style={styles.passwordInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            onPress={() => setShowPassword((visible) => !visible)}
            style={styles.visibilityButton}
            hitSlop={8}
          >
            <RemixIcon
              name={showPassword ? 'eye-off-line' : 'eye-line'}
              size={20}
              color="#176744"
              accessible={false}
            />
          </Pressable>
        </View>

        {authInitializationFailed || error ? (
          <Text style={styles.error}>
            {authInitializationFailed
              ? 'Secure sign-in could not initialize. Restart the app and try again.'
              : error}
          </Text>
        ) : null}

        <Pressable
          onPress={handleForgotPassword}
          disabled={isBusy}
          style={styles.forgotPassword}
        >
          <Text style={styles.link}>
            Forgot Password?
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.button,
            isBusy &&
              styles.buttonDisabled,
          ]}
          onPress={handleLogin}
          disabled={isBusy}
        >
          {isBusy ? (
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
            Rider registration is invitation-only. Open the link sent by your
            administrator to accept an invitation.
          </Text>
        </View>

      </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getLoginErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'The email or password is incorrect.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account is disabled. Contact support.';
    case 'auth/too-many-requests':
      return 'Too many sign-in attempts. Please wait and try again.';
    case 'auth/network-request-failed':
      return 'Unable to reach Firebase. Check your connection and try again.';
    default:
      return 'Unable to sign in right now. Please try again.';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },

  keyboardContainer: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    justifyContent: 'center',
  },

  header: {
    alignItems: 'center',
    marginBottom: 28,
  },

  logo: {
    color: '#176744',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
  },

  role: {
    marginTop: 4,
    color: '#64736A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },

  title: {
    marginTop: 30,
    color: '#173D2C',
    fontSize: 28,
    fontWeight: '800',
  },

  subtitle: {
    marginTop: 8,
    color: '#64736A',
    fontSize: 16,
  },

  form: {
    width: '100%',
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DCE8DE',
    backgroundColor: '#FFFFFF',
  },

  label: {
    marginBottom: 9,
    color: '#173D2C',
    fontSize: 14,
    fontWeight: '700',
  },

  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#DCE8DE',
    borderRadius: 13,
    paddingHorizontal: 14,
    marginBottom: 20,
    color: '#173D2C',
    backgroundColor: '#FAFCFA',
    fontSize: 14,
  },

  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },

  passwordInput: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 0,
    paddingRight: 0,
    color: '#173D2C',
    fontSize: 14,
  },

  visibilityButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  error: {
    marginBottom: 16,
    color: '#B42318',
    fontSize: 14,
    textAlign: 'center',
  },

  button: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#176744',
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
  lineHeight: 20,
  color: '#64736A',
  textAlign: 'center',
},

link: {
  color: '#176744',
  fontWeight: '700',
},

  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -10,
    marginBottom: 20,
    paddingVertical: 4,
  },
});
