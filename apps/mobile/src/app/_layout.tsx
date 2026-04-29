import 'partysocket/event-target-polyfill';
import { Stack } from "expo-router";
import { tokens } from "@pokington/ui";
import { StatusBar } from "expo-status-bar";
import React from "react";

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.colors.background },
        }}
      />
      <StatusBar style="light" />
    </>
  );
}
