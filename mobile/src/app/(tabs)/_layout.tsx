import { Tabs, TabSlot } from 'expo-router/ui';
import { View } from 'react-native';

import { TabBar, TabList, TabTriggers } from '@/design/TabBar';
import { color } from '@/design/tokens';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: color.canvas }}>
      <Tabs style={{ flex: 1 }}>
        <TabSlot style={{ flex: 1 }} />
        <TabList asChild>
          <TabBar>{TabTriggers()}</TabBar>
        </TabList>
      </Tabs>
    </View>
  );
}
