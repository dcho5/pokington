import 'partysocket/event-target-polyfill';
import 'react-native-reanimated';
import { Stack } from "expo-router";
import { useNativeTheme } from "@pokington/ui/native";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme } from "react-native";

export default function RootLayout() {
  const theme = useNativeTheme();
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </GestureHandlerRootView>
  );
}
