import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext/AuthContext';
import { logout } from '../../services/firebase/auth/auth.services';

export default function RiderAccountScreen() {
  const { rider, user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = rider?.fullName?.trim() || user?.displayName?.trim() || 'BasuraGo Rider';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'R';

  useEffect(() => {
    if (!rider) return;
  }, [rider]);

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

  if (!rider) {
    return <SafeAreaView style={styles.safeArea} edges={['top']}><View style={styles.center}><ActivityIndicator size="large" color="#176744" /><Text style={styles.muted}>Loading rider profile…</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => {if ( router.canGoBack()) { router.back(); } else { router.replace('/dashboard');}}} style={styles.backButton}><Text style={styles.backText}>‹  Back</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push('/settings')} style={styles.settingsButton}><Text style={styles.settingsIcon}>⚙</Text></Pressable>
        </View>
        <Text style={styles.eyebrow}>BASURAGO RIDER ACCOUNT</Text>
        <Text style={styles.title}>My Account</Text>
        <View style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileMeta}>{user?.email || 'No email available'}</Text>
            <Text style={styles.profileMeta}>{rider.phoneNumber || 'No phone number added'}</Text>
            <View style={styles.statusBadge}><Text style={styles.statusText}>Rider · {rider.status}</Text></View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Personal information</Text>
        <View style={styles.menuCard}>
          <MenuRow icon="👤" title="Edit profile" subtitle="Update your name and phone number" onPress={() => router.push('/edit-profile')} />
          <Divider />
          <MenuRow icon="🚚" title="Vehicle information" subtitle={rider.vehicleId ? `Assigned vehicle: ${rider.vehicleId}` : 'View your vehicle details'} onPress={() => router.push('/vehicle-information')} />
        </View>

        <Text style={styles.sectionTitle}>Account and support</Text>
        <View style={styles.menuCard}>
          <MenuRow icon="⚙" title="Settings" subtitle="Account preferences and options" onPress={() => router.push('/settings')} />
          <Divider />
          <MenuRow icon="❓" title="Help and support" subtitle="Get help with your rider account" onPress={() => Alert.alert('Help and support', 'Support options will be available here.')} />
          <Divider />
          <MenuRow icon="🔒" title="Privacy" subtitle="Learn how your account data is handled" onPress={() => Alert.alert('Privacy', 'The privacy policy will be added before launch.')} />
        </View>

        <Pressable accessibilityRole="button" disabled={loggingOut} onPress={handleLogout} style={[styles.logoutButton, loggingOut && styles.disabled]}><Text style={styles.logoutText}>{loggingOut ? 'Signing out…' : 'Sign out of BasuraGo'}</Text></Pressable>
        <Text style={styles.footer}>BasuraGo Rider · Collect responsibly</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({ icon, title, subtitle, onPress }: { icon: string; title: string; subtitle: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}><View style={styles.menuIcon}><Text style={styles.menuIconText}>{icon}</Text></View><View style={styles.menuCopy}><Text style={styles.menuTitle}>{title}</Text><Text style={styles.menuSubtitle}>{subtitle}</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}
function Divider() { return <View style={styles.divider} />; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F8F5' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  backButton: { paddingVertical: 8, paddingRight: 12 },
  backText: { color: '#176744', fontSize: 15, fontWeight: '700' },
  settingsButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DCE8DE' },
  settingsIcon: { color: '#176744', fontSize: 23 },
  eyebrow: { color: '#38B84A', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 5 },
  title: { color: '#173D2C', fontSize: 29, fontWeight: '800', marginBottom: 22 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 15, padding: 20, backgroundColor: '#176744', borderRadius: 24, marginBottom: 28 },
  avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#38B84A', borderWidth: 3, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileName: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 5 },
  profileMeta: { color: '#E0F1E5', fontSize: 12, marginTop: 3 },
  statusBadge: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  sectionTitle: { color: '#173D2C', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  menuCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E5ECE6', paddingHorizontal: 14, marginBottom: 25 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, gap: 12 },
  menuIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#EDF7EF', alignItems: 'center', justifyContent: 'center' },
  menuIconText: { fontSize: 19 },
  menuCopy: { flex: 1 },
  menuTitle: { color: '#173D2C', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  menuSubtitle: { color: '#64736A', fontSize: 11, lineHeight: 16 },
  chevron: { color: '#8A9B8F', fontSize: 26, marginLeft: 4 },
  divider: { height: 1, backgroundColor: '#EDF1ED', marginLeft: 54 },
  logoutButton: { minHeight: 54, borderRadius: 17, borderWidth: 1, borderColor: '#F0D8D8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoutText: { color: '#C43D3D', fontSize: 15, fontWeight: '800' },
  footer: { color: '#849187', fontSize: 10, textAlign: 'center', lineHeight: 16, paddingHorizontal: 12 },
  muted: { color: '#64736A', fontSize: 14 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
