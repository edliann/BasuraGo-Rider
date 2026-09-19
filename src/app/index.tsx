import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Redirect,
} from 'expo-router';

import {
  useEffect,
  useState,
} from 'react';

import {
  useAuth,
} from '../contexts/AuthContext/AuthContext';

export default function Index() {
  const {
    user,
    rider,
    loading: authLoading,
  } = useAuth();

  const [onboardingLoading, setOnboardingLoading] =
    useState(true);

  const [showOnboarding, setShowOnboarding] =
    useState(false);

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const completed =
          await AsyncStorage.getItem(
            'basurago_rider_onboarding_complete',
          );

        setShowOnboarding(
          completed !== 'true',
        );
      } catch (error) {
        console.error(
          'Failed to check onboarding:',
          error,
        );

        setShowOnboarding(true);
      } finally {
        setOnboardingLoading(false);
      }
    }

    checkOnboarding();
  }, []);

  if (
    authLoading ||
    onboardingLoading
  ) {
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>
          BasuraGo
        </Text>

        <Text style={styles.role}>
          RIDER
        </Text>

        <ActivityIndicator
          size="small"
          style={styles.loader}
        />
      </View>
    );
  }

  if (!user) {
    if (showOnboarding) {
      return (
        <Redirect href="/onboarding" />
      );
    }

    return (
      <Redirect href="/login" />
    );
  }

  if (!rider) {
    return (
      <Redirect href="/access-denied" />
    );
  }

  return (
    <Redirect href="/dashboard" />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },

  logo: {
    fontSize: 36,
    fontWeight: '700',
  },

  role: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 3,
  },

  loader: {
    marginTop: 32,
  },
});