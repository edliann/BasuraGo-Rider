import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import { useEffect } from 'react';

import {useAuth} from '../../contexts/AuthContext/AuthContext';
import {getRiderAccessDecision} from
  '../../services/firebase/riders/riderAccess';
import {RiderLocationProvider} from
  '../../contexts/RiderLocationContext/RiderLocationContext';

export default function RiderLayout() {
  const pathname = usePathname();
  const {
    user,
    riderStatus,
    application,
    authorizationLoadFailed,
    loading,
  } = useAuth();
  const accessDecision = getRiderAccessDecision(
    riderStatus,
    application?.status,
  );

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    const isVerificationFlow =
      pathname === '/verification' ||
      pathname === '/government-id' ||
      pathname === '/drivers-license' ||
      pathname === '/face-verification' ||
      pathname === '/vehicle-information' ||
      pathname === '/review-application';

    if (authorizationLoadFailed || accessDecision === 'denied') {
      router.replace('/access-denied');
    } else if (
      accessDecision === 'verification' &&
      !isVerificationFlow
    ) {
      router.replace('/verification');
    }
  }, [
    accessDecision,
    authorizationLoadFailed,
    loading,
    pathname,
    user,
  ]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingTitle}>BasuraGo Rider</Text>
        <ActivityIndicator color="#176744" />
        <Text style={styles.loadingMessage}>
          Restoring your secure session…
        </Text>
      </View>
    );
  }

  return (
    <RiderLocationProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </RiderLocationProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#F5F8F6',
  },
  loadingTitle: {
    color: '#176744',
    fontSize: 22,
    fontWeight: '800',
  },
  loadingMessage: {
    color: '#64736A',
    fontSize: 14,
  },
});
