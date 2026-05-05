import 'partysocket/event-target-polyfill';
import 'react-native-reanimated';
import { Stack } from "expo-router";
import { nativeLightTheme } from "@pokington/ui/native";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: nativeLightTheme.colors.background },
        }}
      />
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}
