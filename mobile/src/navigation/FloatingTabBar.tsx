import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Animated, LayoutChangeEvent } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const PILL_H = 52;
const PAD = 4;

export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();

  const pillLeft = useRef(new Animated.Value(0)).current;
  const pillW = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const layouts = useRef<Record<string, { x: number; w: number }>>({}).current;

  const movePill = (routeKey: string, animated = true) => {
    const l = layouts[routeKey];
    if (!l) return;
    const config = { tension: 70, friction: 12, useNativeDriver: false };
    if (animated) {
      Animated.parallel([
        Animated.spring(pillLeft, { toValue: l.x - 1.5, ...config }),
        Animated.spring(pillW, { toValue: l.w + 3, ...config }),
        // Bug 4: animate opacity in the parallel branch too
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: false }),
      ]).start();
    } else {
      pillLeft.setValue(l.x - 1.5);
      pillW.setValue(l.w + 3);
      opacity.setValue(1);
    }
  };

  // Bug 1: useState tracks measured count so changes trigger re-render
  const [measuredCount, setMeasuredCount] = useState(0);
  const routesLen = state.routes.length;
  const allMeasured = measuredCount >= routesLen;

  // Bug 2: Consolidated effect, first-measure flag to avoid instant-setValue override
  const hasMeasured = useRef(false);
  useEffect(() => {
    const route = state.routes[state.index];
    if (!route || !allMeasured) return;

    if (!hasMeasured.current) {
      // First measurement — position instantly, fade in with timing
      hasMeasured.current = true;
      const l = layouts[route.key];
      if (!l) return;
      pillLeft.setValue(l.x - 1.5);
      pillW.setValue(l.w + 3);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    } else {
      movePill(route.key, true);
    }
  }, [state.index, allMeasured]);

  const onLayout = (routeKey: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    if (layouts[routeKey]?.x === x && layouts[routeKey]?.w === width) return;
    layouts[routeKey] = { x, w: width };
    setMeasuredCount((c) => c + 1);
  };

  // Bug 3: Parse primary color hex to RGB for pill background opacity
  const primaryHex = theme.colors.primary;
  const pr = parseInt(primaryHex.slice(1, 3), 16);
  const pg = parseInt(primaryHex.slice(3, 5), 16);
  const pb = parseInt(primaryHex.slice(5, 7), 16);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.dark
              ? theme.colors.surfaceContainerHigh
              : theme.colors.surfaceContainer,
          },
        ]}>
        <Animated.View
          style={[
            styles.pill,
            {
              left: pillLeft,
              width: pillW,
              opacity,
              backgroundColor: `rgba(${pr},${pg},${pb},0.35)`,
            },
          ]}
        />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? theme.colors.onSurface : theme.colors.onSurfaceVariant;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLayout={onLayout(route.key)}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}>
              {options.tabBarIcon
                ? options.tabBarIcon({ focused, color, size: 22 })
                : null}
              <Text
                style={[styles.label, { color }, focused && styles.labelOn]}
                numberOfLines={1}>
                {options.title ?? route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
  },
  bar: {
    flexDirection: 'row',
    borderRadius: 22,
    padding: PAD,
    height: PILL_H + PAD * 2 + 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  pill: {
    position: 'absolute',
    top: PAD,
    height: PILL_H,
    borderRadius: PILL_H / 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    paddingTop: 10,
    paddingBottom: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  labelOn: {
    fontWeight: '800',
  },
});
