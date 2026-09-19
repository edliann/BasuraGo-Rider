import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
} from 'expo-router';

import {
  logout,
} from '../../services/firebase/auth/auth.services';

export default function AccessDenied() {
  async function handleLogout() {
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error(
        'Failed to log out:',
        error,
      );
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Access Denied
      </Text>

      <Text style={styles.message}>
        This account is not authorized to
        access the BasuraGo Rider application.
      </Text>

      <Pressable
        style={styles.button}
        onPress={handleLogout}
      >
        <Text style={styles.buttonText}>
          Back to Login
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
  },

  message: {
    marginTop: 16,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },

  button: {
    marginTop: 32,
    height: 52,
    minWidth: 180,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});