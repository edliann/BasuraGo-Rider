import { Pressable, StyleSheet, Text, View } from 'react-native';

export type RiderNavSection = 'home' | 'available' | 'mine' | 'history';

type BottomNavProps = {
  activeSection: RiderNavSection;
  onSelect: (section: RiderNavSection) => void;
};

const items: { id: RiderNavSection; label: string; symbol: string }[] = [
  { id: 'home', label: 'Home', symbol: '⌂' },
  { id: 'available', label: 'Available', symbol: '♻' },
  { id: 'mine', label: 'My Pickups', symbol: '▤' },
  { id: 'history', label: 'History', symbol: '✓' },
];

export default function BottomNav({
  activeSection,
  onSelect,
}: BottomNavProps) {
  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.feather} />
      <View style={styles.bar}>
        {items.map((item) => {
          const active = activeSection === item.id;

          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(item.id)}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                <Text style={[styles.symbol, active && styles.symbolActive]}>
                  {item.symbol}
                </Text>
              </View>
              <Text style={[styles.label, active && styles.labelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 8,
  },
  feather: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 100,
    backgroundColor: 'rgba(245,248,245,0.68)',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(220,232,222,0.9)',
    paddingVertical: 8,
    paddingHorizontal: 5,
    shadowColor: '#173D2C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 9,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 52,
    borderRadius: 16,
  },
  iconWrap: {
    width: 35,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  iconWrapActive: {
    backgroundColor: '#E8F5EC',
  },
  symbol: {
    color: '#8B9690',
    fontSize: 23,
    fontWeight: '600',
  },
  symbolActive: {
    color: '#176744',
  },
  label: {
    color: '#64736A',
    fontSize: 10,
    fontWeight: '500',
  },
  labelActive: {
    color: '#176744',
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
