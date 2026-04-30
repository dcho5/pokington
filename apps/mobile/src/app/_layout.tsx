import 'partysocket/event-target-polyfill';
import { Stack } from "expo-router";
import { nativeLightTheme } from "@pokington/ui/native";
import { StatusBar } from "expo-status-bar";
import React from "react";

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: nativeLightTheme.colors.background },
        }}
      />
      <StatusBar style="dark" />
    </>
  );
}
