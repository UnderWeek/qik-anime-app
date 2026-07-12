import * as React from "react";
import { Pressable, StyleSheet, Text, View, LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";


// ---------------------------------------------------------------------------
// Types (mirror the original API exactly)
// ---------------------------------------------------------------------------
interface Tab {
  title: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  type?: never;
}

interface Separator {
  type: "separator";
  title?: never;
  icon?: never;
}

type TabItem = Tab | Separator;

interface ExpandableTabsProps {
  tabs: readonly TabItem[];
  className?: string;
  activeColor?: string;
  activeTab?: number | null;
  onChange?: (index: number | null) => void;
}

// ---------------------------------------------------------------------------
// Spring config (matches the original "spring, bounce 0, duration 0.6")
// ---------------------------------------------------------------------------
const springConfig = {
  damping: 15,
  stiffness: 150,
  mass: 0.8,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ExpandableTabs({
  tabs,
  className,
  activeColor = "#FAFAFA",
  activeTab,
  onChange,
}: ExpandableTabsProps) {
  const [selected, setSelected] = React.useState<number | null>(null);

  // Sync external activeTab prop
  const current = activeTab !== undefined ? activeTab : selected;

  const handleSelect = (index: number) => {
    if (activeTab === undefined) {
      setSelected(index);
    }
    onChange?.(index);
  };

  // Separator sub-component
  const SeparatorCmp = () => (
    <View style={styles.separator} accessibilityElementsHidden />
  );

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        {tabs.map((tab, index) => {
          if (tab.type === "separator") {
            return <SeparatorCmp key={`sep-${index}`} />;
          }

          const Icon = tab.icon;
          const isSelected = current === index;

          return (
            <Pressable
              key={tab.title}
              onPress={() => handleSelect(index)}
              style={({ pressed }) => [
                styles.tab,
                isSelected && styles.tabSelected,
                pressed && styles.tabPressed,
              ]}
            >
              <AnimatedTabContent
                icon={Icon}
                label={tab.title}
                isSelected={isSelected}
                activeColor={activeColor}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Animated internals — the expanding pill with icon + optional label
// ---------------------------------------------------------------------------
function AnimatedTabContent({
  icon: Icon,
  label,
  isSelected,
  activeColor,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  isSelected: boolean;
  activeColor: string;
}) {
  const widthSv = useSharedValue(isSelected ? 1 : 0);
  const opacitySv = useSharedValue(isSelected ? 1 : 0);

  React.useEffect(() => {
    widthSv.value = withSpring(isSelected ? 1 : 0, springConfig);
    opacitySv.value = withSpring(isSelected ? 1 : 0, springConfig);
  }, [isSelected]);

  const labelStyle = useAnimatedStyle(() => ({
    maxWidth: widthSv.value * 80,
    opacity: opacitySv.value,
    overflow: "hidden" as const,
  }));

  return (
    <View style={styles.tabInner}>
      <Icon size={20} color={isSelected ? activeColor : "#8F8F99"} />
      <Animated.View style={[styles.labelContainer, labelStyle]}>
        <Text
          style={[styles.label, isSelected && { color: activeColor }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    position: "relative",
    alignSelf: "center",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272A",
    backgroundColor: "#09090B",
    padding: 6,
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  separator: {
    marginHorizontal: 4,
    height: 24,
    width: 1.2,
    backgroundColor: "#27272A",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tabSelected: {
    borderColor: "#18181B",
    backgroundColor: "#18181B",
    paddingHorizontal: 16,
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  labelContainer: {
    overflow: "hidden",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8F8F99",
  },
});
