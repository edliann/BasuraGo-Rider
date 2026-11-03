import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  applyNetworkReachability,
  finishConnectivityStartup,
  getNetworkReachability,
  type ConnectivityStatus,
} from '../utils/connectivity';

const STARTUP_CHECK_TIMEOUT_MS = 5000;

export default function OfflineConnectionGate({
  children,
}: {
  children: ReactNode;
}) {
  const [status, setStatus] = useState<ConnectivityStatus>('checking');
  const [appStarted, setAppStarted] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const statusRef = useRef<ConnectivityStatus>('checking');

  useEffect(() => {
    const updateStatus = (state: NetInfoState) => {
      const next = applyNetworkReachability(
        statusRef.current,
        getNetworkReachability(state),
      );
      if (next === statusRef.current) return;
      statusRef.current = next;
      setStatus(next);
      if (next === 'online') setAppStarted(true);
    };

    const unsubscribe = NetInfo.addEventListener(updateStatus);
    void NetInfo.fetch().then(updateStatus).catch((error: unknown) => {
      console.warn('Unable to complete initial network check:', error);
    });

    const timeout = setTimeout(() => {
      const next = finishConnectivityStartup(statusRef.current);
      if (next !== statusRef.current) {
        statusRef.current = next;
        setStatus(next);
      }
      if (next === 'online') setAppStarted(true);
    }, STARTUP_CHECK_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const retryConnection = async () => {
    setRetrying(true);
    try {
      const state = await NetInfo.fetch();
      const next = applyNetworkReachability(
        statusRef.current,
        getNetworkReachability(state),
      );
      if (next !== statusRef.current) {
        statusRef.current = next;
        setStatus(next);
      }
      if (next === 'online') setAppStarted(true);
    } catch (error) {
      console.warn('Unable to retry network check:', error);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.root}>
      {appStarted ? children : <StartupScreen />}
      {status === 'offline' ? (
        <OfflineScreen retrying={retrying} onRetry={retryConnection} />
      ) : null}
    </View>
  );
}

function StartupScreen() {
  return (
    <View style={styles.startup}>
      <Text style={styles.brand}>BasuraGo</Text>
      <ActivityIndicator color="#176744" style={styles.spinner} />
      <Text style={styles.startupMessage}>Checking your connection...</Text>
    </View>
  );
}

function OfflineScreen({
  retrying,
  onRetry,
}: {
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <SafeAreaView
      accessibilityViewIsModal
      style={styles.offlineScreen}
      edges={['top', 'right', 'bottom', 'left']}
    >
      <View style={styles.content}>
        <View
          accessible
          accessibilityLabel="Wi-Fi off"
          style={styles.iconCircle}
        >
          <View style={styles.wifiGlyph}>
            <View style={[styles.wifiArc, styles.wifiArcOuter]} />
            <View style={[styles.wifiArc, styles.wifiArcMiddle]} />
            <View style={[styles.wifiArc, styles.wifiArcInner]} />
            <View style={styles.wifiDot} />
            <View style={styles.iconSlash} />
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          No Internet Connection
        </Text>
        <Text style={styles.message}>
          Please turn on Wi-Fi or mobile data to continue using BasuraGo.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: retrying }}
          disabled={retrying}
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && !retrying && styles.retryPressed,
            retrying && styles.retryDisabled,
          ]}
        >
          {retrying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.retryText}>Retry Connection</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  startup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F8F6',
  },
  brand: { color: '#176744', fontSize: 32, fontWeight: '800' },
  spinner: { marginTop: 24 },
  startupMessage: { color: '#64736A', fontSize: 14, marginTop: 12 },
  offlineScreen: {
    ...StyleSheet.absoluteFill,
    zIndex: 10000,
    elevation: 10000,
    backgroundColor: '#F5F8F6',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 52,
    backgroundColor: '#E4F2E9',
    marginBottom: 28,
  },
  wifiGlyph: {
    width: 76,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wifiArc: {
    position: 'absolute',
    borderColor: '#176744',
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
  },
  wifiArcOuter: { top: 3, width: 68, height: 50 },
  wifiArcMiddle: { top: 17, width: 46, height: 34 },
  wifiArcInner: { top: 31, width: 24, height: 18 },
  wifiDot: {
    position: 'absolute',
    bottom: 1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#176744',
  },
  iconSlash: {
    position: 'absolute',
    width: 82,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#176744',
    transform: [{ rotate: '-45deg' }],
  },
  title: {
    color: '#173D2C',
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    maxWidth: 340,
    color: '#64736A',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    minWidth: 190,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#176744',
    paddingHorizontal: 24,
    marginTop: 30,
  },
  retryPressed: { opacity: 0.8 },
  retryDisabled: { opacity: 0.65 },
  retryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
