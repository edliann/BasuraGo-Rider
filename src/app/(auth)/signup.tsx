import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { useState } from 'react';

import LegalDocumentModal from '../../components/common/LegalDocumentModal';

import {
  registerRider,
} from '../../services/firebase/auth/auth.services';

export default function SignupScreen() {
  const [showTerms, setShowTerms] =
    useState(false);

  const [showPrivacy, setShowPrivacy] =
    useState(false);

  const [acceptedTerms, setAcceptedTerms] =
    useState(false);

  const [fullName, setFullName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [phoneNumber, setPhoneNumber] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [submitting, setSubmitting] =
    useState(false);

  async function handleSignup() {
    if (!fullName.trim()) {
      Alert.alert(
        'Missing Information',
        'Please enter your full name.',
      );
      return;
    }

    if (!email.trim()) {
      Alert.alert(
        'Missing Information',
        'Please enter your email address.',
      );
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert(
        'Missing Information',
        'Please enter your phone number.',
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Invalid Password',
        'Password must be at least 6 characters.',
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        'Passwords Do Not Match',
        'Please make sure both passwords are the same.',
      );
      return;
    }

    if (!acceptedTerms) {
      Alert.alert(
        'Agreement Required',
        'Please agree to the Terms of Service and acknowledge the Privacy Notice.',
      );
      return;
    }

    try {
      setSubmitting(true);

      await registerRider(
        fullName,
        email,
        password,
        phoneNumber,
      );

      Alert.alert(
        'Account Created',
        'Your rider account has been created. Please complete your verification requirements.',
        [
          {
            text: 'Continue',
            onPress: () =>
              router.replace('/verification'),
          },
        ],
      );
    } catch (error: any) {
      console.error(
        'Rider registration failed:',
        error,
      );

      switch (error?.code) {
        case 'auth/email-already-in-use':
          Alert.alert(
            'Email Already Registered',
            'An account already exists with this email address.',
          );
          break;

        case 'auth/invalid-email':
          Alert.alert(
            'Invalid Email',
            'Please enter a valid email address.',
          );
          break;

        case 'auth/weak-password':
          Alert.alert(
            'Weak Password',
            'Please choose a stronger password.',
          );
          break;

        default:
          Alert.alert(
            'Registration Failed',
            'Unable to create your account right now. Please try again.',
          );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        style={styles.backButton}
        onPress={() => router.replace('/login')}
      >
        <Text style={styles.backButtonText}>
          ← Back
        </Text>
      </Pressable>

      <Text style={styles.title}>
        Create Rider Account
      </Text>

      <Text style={styles.subtitle}>
        Register to become a BasuraGo rider.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>
          Full Name
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          autoCapitalize="words"
          value={fullName}
          onChangeText={setFullName}
        />

        <Text style={styles.label}>
          Email
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>
          Phone Number
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your phone number"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />

        <Text style={styles.label}>
          Password
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Create a password"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>
          Confirm Password
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Confirm your password"
          secureTextEntry
          autoCapitalize="none"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <Pressable
          style={styles.agreementRow}
          onPress={() =>
            setAcceptedTerms(!acceptedTerms)
          }
        >
          <View
            style={[
              styles.checkbox,
              acceptedTerms &&
                styles.checkboxSelected,
            ]}
          >
            {acceptedTerms && (
              <Text style={styles.checkmark}>
                ✓
              </Text>
            )}
          </View>

          <Text style={styles.agreementText}>
            I agree to the BasuraGo{' '}
            <Text
              style={styles.link}
              onPress={() =>
                setShowTerms(true)
              }
            >
              Terms of Service
            </Text>{' '}
            and acknowledge the{' '}
            <Text
              style={styles.link}
              onPress={() =>
                setShowPrivacy(true)
              }
            >
              Privacy Notice
            </Text>
            .
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.primaryButton,
            submitting &&
              styles.primaryButtonDisabled,
          ]}
          onPress={handleSignup}
          disabled={submitting}
        >
          <Text style={styles.primaryButtonText}>
            {submitting
              ? 'Creating Account...'
              : 'Create Account'}
          </Text>
        </Pressable>

        <View style={styles.signInRow}>
          <Text style={styles.signInText}>
            Already have an account?
          </Text>

          <Pressable
            onPress={() =>
              router.replace('/login')
            }
          >
            <Text style={styles.link}>
              Sign In
            </Text>
          </Pressable>
        </View>
      </View>

      <LegalDocumentModal
        visible={showTerms}
        type="terms"
        onClose={() =>
          setShowTerms(false)
        }
      />

      <LegalDocumentModal
        visible={showPrivacy}
        type="privacy"
        onClose={() =>
          setShowPrivacy(false)
        }
      />
    </ScrollView>
  );
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
    paddingTop: 60,
    paddingBottom: 40,
  },

  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 24,
  },

  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },

  form: {
    width: '100%',
  },

  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 18,
  },

  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 24,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: '#888888',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },

  checkboxSelected: {
    backgroundColor: '#1b5e20',
    borderColor: '#1b5e20',
  },

  checkmark: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },

  agreementText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },

  link: {
    color: '#1b5e20',
    fontWeight: '700',
  },

  primaryButton: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1b5e20',
  },

  primaryButtonDisabled: {
    opacity: 0.6,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },

  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 24,
  },

  signInText: {
    fontSize: 14,
  },
});