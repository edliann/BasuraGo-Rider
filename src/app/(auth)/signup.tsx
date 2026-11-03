import { router } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function SignupScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rider accounts are invitation-only</Text>
      <Text style={styles.description}>
        To create a BasuraGo Rider account, open the invitation link sent to
        you by an administrator. If you already have an account, you can sign
        in below.
      </Text>
      <Pressable
        accessibilityRole="button"
        style={styles.button}
        onPress={() => router.replace('/login')}
      >
        <Text style={styles.buttonText}>Back to Sign In</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F5F8F6',
    paddingHorizontal: 24,
  },
  title: {
    color: '#173D2C',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 12,
  },
  description: {
    color: '#64736A',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 28,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#176744',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
