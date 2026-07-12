import { useRouter, usePathname } from 'expo-router';
import { Home, LayoutGrid, Users, CircleUser } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExpandableTabs } from '@/components/ui/expandable-tabs';

const TABS = [
  { title: 'Главная', icon: Home, route: '/' },
  { title: 'Каталог', icon: LayoutGrid, route: '/catalog' },
  { title: 'Друзья', icon: Users, route: '/friends' },
  { title: 'Профиль', icon: CircleUser, route: '/profile' },
] as const;

export default function AppTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const activeIndex = TABS.findIndex((t) => t.route === pathname);

  const handleChange = (index: number | null) => {
    if (index !== null && index !== activeIndex) {
      router.push(TABS[index].route as any);
    }
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 12 }]}>
      <ExpandableTabs
        tabs={TABS}
        activeTab={activeIndex >= 0 ? activeIndex : null}
        onChange={handleChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
});
