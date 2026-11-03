import { router, usePathname } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

type NavItem = {
  path: string;
  label: string;
  icon: number;
  matches: (pathname: string) => boolean;
};

const items: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: require('../../../assets/bottomNav/home-icon.png'), matches: (path) => path === '/dashboard' },
  { path: '/available-pickups', label: 'Available', icon: require('../../../assets/bottomNav/available-icon.png'), matches: (path) => path === '/available-pickups' },
  { path: '/my-pickups', label: 'My Pickups', icon: require('../../../assets/bottomNav/my-pickup-icon.png'), matches: (path) => path === '/my-pickups' },
  { path: '/pickup-history', label: 'History', icon: require('../../../assets/bottomNav/pickup-history-icon.png'), matches: (path) => path === '/pickup-history' },
  { path: '/account', label: 'Account', icon: require('../../../assets/bottomNav/account-icon.png'), matches: (path) => path === '/account' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.feather} />
      <View style={styles.bar}>
        {items.map((item) => {
          const active = item.matches(pathname);
          return (
            <Pressable
              key={item.path}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (!active) router.replace(item.path as never);
              }}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                <Image
                  source={item.icon}
                  style={[styles.icon, !active && styles.iconInactive]}
                  resizeMode="contain"
                  accessible={false}
                />
              </View>
              <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 30, paddingBottom: 8 },
  feather: { position: 'absolute', left: 0, right: 0, top: 0, height: 100, backgroundColor: 'rgba(245,248,245,0.68)' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(220,232,222,0.9)', paddingVertical: 8, paddingHorizontal: 5, shadowColor: '#173D2C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 9 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52, borderRadius: 16 },
  iconWrap: { width: 35, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  iconWrapActive: { backgroundColor: '#E8F5EC' },
  icon: { width: 20, height: 20 },
  iconInactive: { opacity: 0.58 },
  label: { color: '#64736A', fontSize: 9, fontWeight: '500', textAlign: 'center' },
  labelActive: { color: '#176744', fontWeight: '800' },
  pressed: { opacity: 0.72 },
});
