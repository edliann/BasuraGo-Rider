import { useMemo, useState } from 'react';

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

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  login,
} from '../../services/firebase/auth/auth.services';

import {
  createRiderAccountFromInvitation,
  completeRiderInvitation,
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

  function handleBackToInvitation() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/invitation',
      params: { invitationId, invitationToken },
    });
  }

  const [fullName, setFullName] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [existingAccount, setExistingAccount] =
    useState(false);

  const [error, setError] =
    useState('');

  const passwordRequirements = useMemo(
    () => ({
      minLength: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
      noSpaces: !/\s/.test(password),
    }),
    [password],
  );

  const passwordScore = useMemo(() => {
    return Object.values(
      passwordRequirements,
    ).filter(Boolean).length;
  }, [passwordRequirements]);

  const passwordStrength = useMemo(() => {
    if (!password) {
      return {
        label: 'Enter a password',
        level: 0,
      };
    }

    if (passwordScore <= 2) {
      return {
        label: 'Weak',
        level: 1,
      };
    }

    if (passwordScore === 3) {
      return {
        label: 'Fair',
        level: 2,
      };
    }

    if (
      passwordScore === 4 ||
      passwordScore === 5
    ) {
      return {
        label: 'Good',
        level: 3,
      };
    }

    return {
      label: 'Strong',
      level: 4,
    };
  }, [password, passwordScore]);

  const isPasswordValid =
    passwordScore === 6;

  const passwordsMatch =
    password.length > 0 &&
    password === confirmPassword;

  const canCreateAccount =
    !loading &&
    fullName.trim().length > 0 &&
    password.length > 0 &&
    (existingAccount || (isPasswordValid && passwordsMatch));

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

    if (!existingAccount && !isPasswordValid) {
      setError(
        'Please create a stronger password that meets all the requirements.',
      );

      return;
    }

    if (!existingAccount && !passwordsMatch) {
      setError(
        'Passwords do not match.',
      );

      return;
    }

    try {
      setLoading(true);
      setError('');

      if (existingAccount) {
        await login(email, password);
        await completeRiderInvitation({
          invitationId,
          invitationToken,
          fullName: fullName.trim(),
        });
      } else {
        await createRiderAccountFromInvitation({
          invitationId,
          invitationToken,
          fullName: fullName.trim(),
          password,
        });

        await login(email, password);
      }

      router.replace('/verification');
    } catch (err: any) {
      if (
        !existingAccount &&
        err?.code ===
        'functions/already-exists'
      ) {
        setExistingAccount(true);
        setError(
          'This email already has an account. Enter its password to sign in and continue your Rider invitation.',
        );
      } else if (err?.code === 'auth/invalid-credential') {
        setError('The password was not accepted. Please try again.');
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
      } else if (
        err?.code ===
        'functions/invalid-argument'
      ) {
        setError(
          err?.message ||
            'Please check your information and try again.',
        );
      } else {
        console.error('Failed to complete rider invitation:', {
          code: err?.code ?? 'unknown',
        });
        setError(
          'Unable to complete your Rider invitation. Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : 'height'
      }
      keyboardVerticalOffset={20}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={
          styles.scrollContent
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to invitation"
            onPress={handleBackToInvitation}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>‹  Back to Invitation</Text>
          </Pressable>
          <View style={styles.header}>
            <Text style={styles.logo}>
              BasuraGo
            </Text>

            <Text style={styles.role}>
              RIDER
            </Text>

            <Text style={styles.title}>
              {existingAccount ? 'Sign In to Continue' : 'Create Your Account'}
            </Text>

            <Text style={styles.subtitle}>
              {existingAccount
                ? 'Use the existing account for this email. Your Customer profile will not be changed.'
                : 'Your invitation has been verified.'}
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
              onChangeText={(value) => {
                setFullName(value);
                setError('');
              }}
              placeholder="Enter your full name"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              style={styles.input}
              editable={!loading}
            />

            <Text style={styles.label}>
              Password
            </Text>

            <View style={styles.passwordContainer}>
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setError('');
                }}
                placeholder={existingAccount
                  ? 'Enter your existing password'
                  : 'Create a strong password'}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={existingAccount ? 'current-password' : 'new-password'}
                textContentType={existingAccount ? 'password' : 'newPassword'}
                returnKeyType="next"
                style={styles.passwordInput}
                editable={!loading}
              />

              <Pressable
                style={styles.visibilityButton}
                onPress={() =>
                  setShowPassword(
                    (current) => !current,
                  )
                }
                disabled={loading}
                hitSlop={8}
              >
                <Text
                  style={styles.visibilityText}
                >
                  {showPassword
                    ? 'Hide'
                    : 'Show'}
                </Text>
              </Pressable>
            </View>

            {!existingAccount && password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View
                  style={styles.strengthHeader}
                >
                  <Text
                    style={
                      styles.strengthLabel
                    }
                  >
                    Password strength
                  </Text>

                  <Text
                    style={[
                      styles.strengthValue,
                      passwordStrength.level ===
                        1 &&
                        styles.strengthWeak,
                      passwordStrength.level ===
                        2 &&
                        styles.strengthFair,
                      passwordStrength.level ===
                        3 &&
                        styles.strengthGood,
                      passwordStrength.level ===
                        4 &&
                        styles.strengthStrong,
                    ]}
                  >
                    {passwordStrength.label}
                  </Text>
                </View>

                <View
                  style={styles.strengthBar}
                >
                  {[
                    1,
                    2,
                    3,
                    4,
                  ].map((segment) => (
                    <View
                      key={segment}
                      style={[
                        styles.strengthSegment,
                        segment <=
                          passwordStrength.level &&
                          styles.strengthSegmentActive,
                      ]}
                    />
                  ))}
                </View>

                <View
                  style={styles.requirements}
                >
                  <PasswordRequirement
                    met={
                      passwordRequirements.minLength
                    }
                    text="At least 8 characters"
                  />

                  <PasswordRequirement
                    met={
                      passwordRequirements.uppercase
                    }
                    text="One uppercase letter"
                  />

                  <PasswordRequirement
                    met={
                      passwordRequirements.lowercase
                    }
                    text="One lowercase letter"
                  />

                  <PasswordRequirement
                    met={
                      passwordRequirements.number
                    }
                    text="One number"
                  />

                  <PasswordRequirement
                    met={
                      passwordRequirements.special
                    }
                    text="One special character"
                  />

                  <PasswordRequirement
                    met={
                      passwordRequirements.noSpaces
                    }
                    text="No spaces"
                  />
                </View>
              </View>
            )}

            {!existingAccount && <>
              <Text style={styles.label}>
                Confirm Password
              </Text>

              <View style={styles.passwordContainer}>
              <TextInput
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  setError('');
                }}
                placeholder="Confirm your password"
                secureTextEntry={
                  !showConfirmPassword
                }
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={
                  canCreateAccount
                    ? handleCreateAccount
                    : undefined
                }
                style={styles.passwordInput}
                editable={!loading}
              />

              <Pressable
                style={styles.visibilityButton}
                onPress={() =>
                  setShowConfirmPassword(
                    (current) => !current,
                  )
                }
                disabled={loading}
                hitSlop={8}
              >
                <Text
                  style={styles.visibilityText}
                >
                  {showConfirmPassword
                    ? 'Hide'
                    : 'Show'}
                </Text>
              </Pressable>
              </View>

              {confirmPassword.length > 0 && (
                <Text
                  style={[
                    styles.matchText,
                    passwordsMatch
                      ? styles.matchSuccess
                      : styles.matchError,
                  ]}
                >
                  {passwordsMatch
                    ? '✓ Passwords match'
                    : 'Passwords do not match'}
                </Text>
              )}
            </>}

            {error ? (
              <Text style={styles.error}>
                {error}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.button,
                !canCreateAccount &&
                  styles.buttonDisabled,
              ]}
              onPress={handleCreateAccount}
              disabled={!canCreateAccount}
            >
              {loading ? (
                <ActivityIndicator
                  color="#ffffff"
                />
              ) : (
                <Text style={styles.buttonText}>
                  {existingAccount ? 'Sign In & Continue' : 'Create Account'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PasswordRequirement({
  met,
  text,
}: {
  met: boolean;
  text: string;
}) {
  return (
    <View style={styles.requirementRow}>
      <Text
        style={[
          styles.requirementIcon,
          met
            ? styles.requirementMet
            : styles.requirementUnmet,
        ]}
      >
        {met ? '✓' : '○'}
      </Text>

      <Text
        style={[
          styles.requirementText,
          met &&
            styles.requirementTextMet,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingVertical: 40,
  },

  container: {
    width: '100%',
    paddingHorizontal: 24,
  },

  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: 8,
  },

  backButtonText: {
    color: '#176744',
    fontSize: 14,
    fontWeight: '700',
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
    color: '#64736A',
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
    borderColor: '#DCE8DE',
    borderRadius: 13,
    paddingHorizontal: 16,
    marginBottom: 18,
    fontSize: 16,
    backgroundColor: '#FAFCFA',
  },

  lockedField: {
    height: 52,
    borderWidth: 1,
    borderColor: '#DCE8DE',
    borderRadius: 13,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#EFF8F1',
    marginBottom: 18,
  },

  lockedText: {
    fontSize: 16,
    color: '#64736A',
  },

  passwordContainer: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCE8DE',
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },

  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 16,
  },

  visibilityButton: {
    paddingHorizontal: 14,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  visibilityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#176744',
  },

  strengthContainer: {
    marginBottom: 20,
  },

  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  strengthLabel: {
    fontSize: 13,
    color: '#64736A',
  },

  strengthValue: {
    fontSize: 13,
    fontWeight: '700',
  },

  strengthWeak: {
    color: '#b3261e',
  },

  strengthFair: {
    color: '#a15c00',
  },

  strengthGood: {
    color: '#357a38',
  },

  strengthStrong: {
    color: '#176744',
  },

  strengthBar: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 12,
  },

  strengthSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#DCE8DE',
  },

  strengthSegmentActive: {
    backgroundColor: '#176744',
  },

  requirements: {
    gap: 5,
  },

  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  requirementIcon: {
    width: 22,
    fontSize: 15,
    fontWeight: '700',
  },

  requirementMet: {
    color: '#176744',
  },

  requirementUnmet: {
    color: '#999999',
  },

  requirementText: {
    fontSize: 13,
    color: '#8B9690',
  },

  requirementTextMet: {
    color: '#173D2C',
  },

  matchText: {
    marginTop: -4,
    marginBottom: 16,
    fontSize: 13,
  },

  matchSuccess: {
    color: '#176744',
  },

  matchError: {
    color: '#b3261e',
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
    backgroundColor: '#176744',
  },

  buttonDisabled: {
    opacity: 0.4,
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
