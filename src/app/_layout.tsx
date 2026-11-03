import { Stack } from 'expo-router';

import {
  AuthProvider,
} from '../contexts/AuthContext/AuthContext';
import OfflineConnectionGate from '../components/OfflineConnectionGate';
import '../services/location/riderBackgroundLocationTask';

export default function RootLayout() {
  return (
    <AuthProvider>
      <OfflineConnectionGate>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </OfflineConnectionGate>
    </AuthProvider>
  );
}
