import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext/AuthContext';
import { updateRiderProfile } from '../../services/firebase/riders/riders.services';

export default function EditRiderProfileScreen() {
  const { rider, user, loading } = useAuth();

  if (loading || !rider) {
    return <SafeAreaView style={styles.safeArea} edges={['top']}><View style={styles.loading}><ActivityIndicator size="large" color="#176744" /><Text style={styles.muted}>Loading your profile…</Text></View></SafeAreaView>;
  }

  return (
    <EditRiderProfileForm
      key={rider.id}
      rider={rider}
      initialFullName={user?.displayName ?? ''}
    />
  );
}

type EditRiderProfileFormProps = {
  rider: NonNullable<ReturnType<typeof useAuth>['rider']>;
  initialFullName: string;
};

function EditRiderProfileForm({
  rider,
  initialFullName,
}: EditRiderProfileFormProps) {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const parentRoute = returnTo === '/settings' ? '/settings' : '/account';
  const parentLabel = parentRoute === '/settings' ? 'Settings' : 'Account';
  function handleBackToParent() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(parentRoute);
  }
  const [fullName, setFullName] = useState(
    rider.fullName ?? initialFullName,
  );
  const [phoneNumber, setPhoneNumber] = useState(rider.phoneNumber ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!fullName.trim()) {
      Alert.alert('Missing name', 'Please enter your full name.');
      return;
    }
    if (!phoneNumber.trim()) {
      Alert.alert('Missing phone number', 'Please enter your phone number.');
      return;
    }
    setSaving(true);
    try {
      await updateRiderProfile(rider.id, { fullName, phoneNumber });
      Alert.alert('Profile updated', 'Your changes have been saved.', [{ text: 'OK', onPress: handleBackToParent }]);
    } catch (error) {
      console.error('Failed to update rider profile:', error);
      Alert.alert('Save failed', 'We could not save your changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return <SafeAreaView style={styles.safeArea} edges={['top']}><KeyboardAvoidingView style={styles.keyboardAvoiding} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="none" showsVerticalScrollIndicator={false}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${parentLabel.toLowerCase()}`} onPress={handleBackToParent} style={styles.backButton}><Text style={styles.backText}>‹  Back to {parentLabel}</Text></Pressable>
    <Text style={styles.eyebrow}>YOUR BASURAGO RIDER ACCOUNT</Text>
    <Text style={styles.title}>Edit profile</Text>
    <Text style={styles.subtitle}>Keep your rider contact information up to date.</Text>
    <View style={styles.formCard}>
      <Text style={styles.label}>Full name</Text>
      <TextInput value={fullName} onChangeText={setFullName} placeholder="Enter your full name" autoCapitalize="words" autoCorrect={false} editable={!saving} style={styles.input} />
      <Text style={styles.label}>Phone number</Text>
      <TextInput value={phoneNumber} onChangeText={setPhoneNumber} placeholder="09XXXXXXXXX or +639XXXXXXXXX" keyboardType="phone-pad" editable={!saving} style={styles.input} />
      <Text style={styles.helper}>Use the mobile number your operations team can reach you on.</Text>
      <Pressable accessibilityRole="button" disabled={saving} onPress={handleSave} style={[styles.saveButton, saving && styles.disabled]}><Text style={styles.saveText}>{saving ? 'Saving changes…' : 'Save changes'}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={handleBackToParent} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F8F6' },
  keyboardAvoiding: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 22, paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { color: '#64736A', fontSize: 14 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginBottom: 22 },
  backText: { color: '#176744', fontSize: 14, fontWeight: '700' },
  eyebrow: { color: '#38B84A', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  title: { color: '#173D2C', fontSize: 29, fontWeight: '800' },
  subtitle: { color: '#64736A', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 26 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#DCE8DE', padding: 20 },
  label: { color: '#173D2C', fontSize: 14, fontWeight: '700', marginBottom: 9 },
  input: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: '#DCE8DE', backgroundColor: '#FAFCFA', paddingHorizontal: 14, color: '#173D2C', fontSize: 14, marginBottom: 19 },
  helper: { color: '#64736A', fontSize: 12, lineHeight: 18, marginTop: -8, marginBottom: 22 },
  saveButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#176744', alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  cancelButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cancelText: { color: '#64736A', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});
