import { useLocalSearchParams } from "expo-router";
import React from "react";
import { WebShell } from "../../components/WebShell";

export default function TableScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const code = String(params.code ?? "").toUpperCase();

  return <WebShell path={`/t/${encodeURIComponent(code)}`} />;
}
