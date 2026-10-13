import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext/AuthContext';
import { logout } from '../../services/firebase/auth/auth.services';

export default function RiderSettingsScreen() {
  const { rider, user } = useAuth();
  const [pickupAlerts, setPickupAlerts] = useState(true);
  const [accountAlerts, setAccountAlerts] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out of BasuraGo Rider?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
        try {
          setLoggingOut(true);
          await logout();
          router.replace('/login');
        } catch (error) {
          console.error('Failed to sign out:', error);
          Alert.alert('Unable to sign out', 'Please try again.');
        } finally {
          setLoggingOut(false);
        }
      } },
    ]);
  }

  return <SafeAreaView style={styles.safeArea} edges={['top']}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹  Back</Text></Pressable>
    <Text style={styles.eyebrow}>BASURAGO RIDER</Text>
    <Text style={styles.title}>Settings</Text>
    <Text style={styles.subtitle}>Manage your account and rider preferences.</Text>

    <View style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{(rider?.fullName || user?.displayName || 'R').trim().charAt(0).toUpperCase()}</Text></View><View style={styles.profileInfo}><Text style={styles.profileName}>{rider?.fullName || user?.displayName || 'Rider'}</Text><Text style={styles.email}>{user?.email || ''}</Text></View></View>

    <Text style={styles.sectionTitle}>Account</Text>
    <View style={styles.optionsCard}>
      <OptionRow icon="♙" title="My Account" onPress={() => router.push('/account')} />
      <Divider />
      <OptionRow icon="✎" title="Edit profile" onPress={() => router.push('/edit-profile')} />
      <Divider />
      <OptionRow icon="🚚" title="Vehicle information" onPress={() => router.push('/vehicle-information')} />
    </View>

    <Text style={styles.sectionTitle}>Notifications</Text>
    <View style={styles.optionsCard}>
      <View style={styles.toggleRow}><View style={styles.toggleCopy}><Text style={styles.optionText}>Pickup updates</Text><Text style={styles.helper}>Requests and pickup status updates</Text></View><Switch value={pickupAlerts} onValueChange={setPickupAlerts} trackColor={{ false: '#D5DDD7', true: '#A7D9B7' }} thumbColor={pickupAlerts ? '#176744' : '#FFFFFF'} /></View>
      <Divider />
      <View style={styles.toggleRow}><View style={styles.toggleCopy}><Text style={styles.optionText}>Account notices</Text><Text style={styles.helper}>Important account and verification notices</Text></View><Switch value={accountAlerts} onValueChange={setAccountAlerts} trackColor={{ false: '#D5DDD7', true: '#A7D9B7' }} thumbColor={accountAlerts ? '#176744' : '#FFFFFF'} /></View>
    </View>
    <Text style={styles.notice}>Notification switches are visual preferences for now. They do not yet change push-notification delivery.</Text>

    <Pressable accessibilityRole="button" disabled={loggingOut} onPress={handleLogout} style={[styles.logoutButton, loggingOut && styles.disabled]}><Text style={styles.logoutText}>{loggingOut ? 'Signing out…' : 'Sign out'}</Text></Pressable>
    <Text style={styles.footer}>BasuraGo Rider · Collect responsibly</Text>
  </ScrollView></SafeAreaView>;
}

function OptionRow({ icon, title, onPress }: { icon: string; title: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.optionRow, pressed && styles.pressed]}><Text style={styles.optionIcon}>{icon}</Text><Text style={styles.optionText}>{title}</Text><Text style={styles.chevron}>›</Text></Pressable>;
}
function Divider() { return <View style={styles.separator} />; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F8F5' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 22, paddingBottom: 40 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 18 },
  backText: { color: '#176744', fontSize: 16, fontWeight: '700' },
  eyebrow: { color: '#38B84A', fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginBottom: 6 },
  title: { color: '#173D2C', fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#64736A', fontSize: 14, marginTop: 7, marginBottom: 24 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#DCE8DE', marginBottom: 27 },
  avatar: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5EC' },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#176744' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '800', color: '#173D2C' },
  email: { fontSize: 12, color: '#64736A', marginTop: 5 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#173D2C', marginBottom: 12 },
  optionsCard: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 16, borderWidth: 1, borderColor: '#DCE8DE', marginBottom: 25 },
  optionRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionIcon: { width: 32, fontSize: 22, color: '#176744', textAlign: 'center' },
  optionText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#173D2C' },
  chevron: { fontSize: 25, color: '#8B9690' },
  separator: { height: 1, backgroundColor: '#E7EEE9' },
  toggleRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  toggleCopy: { flex: 1 },
  helper: { color: '#64736A', fontSize: 11, lineHeight: 16, marginTop: 4 },
  notice: { color: '#64736A', fontSize: 11, lineHeight: 16, marginTop: -13, marginBottom: 24 },
  logoutButton: { minHeight: 52, marginTop: 5, borderRadius: 14, borderWidth: 1, borderColor: '#C94D4D', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  logoutText: { color: '#B42323', fontSize: 15, fontWeight: '800' },
  footer: { textAlign: 'center', color: '#8B9690', marginTop: 28, fontSize: 12 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
