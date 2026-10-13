import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext/AuthContext';
import { getAvailablePickups, getMyPickups, getPickupHistory } from '../../services/firebase/pickups/pickup.services';
import type { Pickup } from '../../services/firebase/pickups/pickup.types';
import PickupCard from './PickupCard';
import MyPickupCard from './MyPickupCard';
import PickupHistoryCard from './PickupHistoryCard';
import BottomNav from '../common/BottomNav';

export type PickupListMode = 'available' | 'mine' | 'history';

const pageCopy: Record<PickupListMode, { title: string; subtitle: string; emptyTitle: string; emptyMessage: string }> = {
  available: { title: 'Available Pickups', subtitle: 'Review new requests and accept the collections you can complete.', emptyTitle: 'No available pickups', emptyMessage: 'New collection requests will appear here when they are available.' },
  mine: { title: 'My Pickups', subtitle: 'Manage the collections assigned to you from acceptance to completion.', emptyTitle: 'No active pickups', emptyMessage: 'Pickups you accept will appear here until they are completed.' },
  history: { title: 'Pickup History', subtitle: 'Review your completed collections and recorded waste weights.', emptyTitle: 'No completed pickups yet', emptyMessage: 'Your completed collections will be saved here for reference.' },
};

export default function PickupListScreen({ mode }: { mode: PickupListMode }) {
  const { rider, loading: authLoading } = useAuth();
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!rider) {
      setPickups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      let result: Pickup[];
      if (mode === 'available') result = await getAvailablePickups();
      else if (mode === 'mine') result = (await getMyPickups(rider.id)).filter((pickup) => pickup.status !== 'completed');
      else result = await getPickupHistory(rider.id);
      setPickups(result);
    } catch (err) {
      console.error('Failed to load pickup list:', err);
      setError('We could not load this list. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [mode, rider]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const copy = pageCopy[mode];

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/dashboard')} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>B</Text></View>
          <View style={styles.brandCopy}><Text style={styles.brand}>BasuraGo</Text><Text style={styles.eyebrow}>RIDER WORKSPACE</Text></View>
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}><Text style={styles.summaryIconText}>{mode === 'available' ? '♻' : mode === 'mine' ? '▤' : '✓'}</Text></View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryLabel}>{mode === 'available' ? 'READY TO ACCEPT' : mode === 'mine' ? 'YOUR ASSIGNED WORK' : 'COMPLETED COLLECTIONS'}</Text>
            <Text style={styles.summaryNumber}>{authLoading || loading ? '—' : pickups.length}</Text>
            <Text style={styles.summaryCaption}>{mode === 'available' ? 'requests available now' : mode === 'mine' ? 'active pickups' : 'completed pickups'}</Text>
          </View>
        </View>

        {!authLoading && !rider ? <View style={styles.notice}><Text style={styles.noticeText}>Your rider profile is not available. Please sign in again.</Text></View> : null}
        {(authLoading || loading) && <ActivityIndicator size="large" color="#167647" style={styles.loader} />}
        {!authLoading && !loading && error ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Unable to load pickups</Text><Text style={styles.emptyText}>{error}</Text><Pressable style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}
        {!authLoading && !loading && !error && pickups.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyIcon}>{mode === 'available' ? '♻' : mode === 'mine' ? '▤' : '✓'}</Text><Text style={styles.emptyTitle}>{copy.emptyTitle}</Text><Text style={styles.emptyText}>{copy.emptyMessage}</Text></View> : null}

        {!authLoading && !loading && !error && pickups.map((pickup) => {
          if (mode === 'available') return <PickupCard key={pickup.id} pickup={pickup} onAccepted={() => void load()} />;
          if (mode === 'mine') return <MyPickupCard key={pickup.id} pickup={pickup} riderId={rider?.id ?? ''} onStarted={() => void load()} />;
          return <PickupHistoryCard key={pickup.id} pickup={pickup} />;
        })}
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F5' },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 145 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  backButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8DE' },
  backText: { color: '#176744', fontSize: 30, lineHeight: 32, marginTop: -3 },
  brandMark: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#D7F5A6', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#105C3B', fontSize: 23, fontWeight: '900' },
  brandCopy: { flex: 1 },
  brand: { color: '#176744', fontSize: 19, fontWeight: '900' },
  eyebrow: { marginTop: 3, color: '#8B9690', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#1A2B20', fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { marginTop: 7, marginBottom: 20, color: '#718076', fontSize: 13, lineHeight: 19 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, marginBottom: 22, borderRadius: 20, backgroundColor: '#105C3B' },
  summaryIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#D7F5A6', alignItems: 'center', justifyContent: 'center' },
  summaryIconText: { color: '#105C3B', fontSize: 26, fontWeight: '900' },
  summaryCopy: { flex: 1 },
  summaryLabel: { color: '#BDE3C9', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  summaryNumber: { marginTop: 4, color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  summaryCaption: { color: '#D3E9DA', fontSize: 11 },
  loader: { marginVertical: 24 },
  notice: { padding: 14, borderRadius: 12, backgroundColor: '#FFF1CC' },
  noticeText: { color: '#8A5B10', fontSize: 12, lineHeight: 18 },
  emptyCard: { paddingHorizontal: 22, paddingVertical: 28, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#E6EDE7', borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
  emptyIcon: { color: '#167647', fontSize: 30, fontWeight: '700' },
  emptyTitle: { marginTop: 9, color: '#25352A', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyText: { maxWidth: 280, marginTop: 6, color: '#7A887E', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 11, backgroundColor: '#167647' },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
