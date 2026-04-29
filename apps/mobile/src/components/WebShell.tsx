import { env } from "@pokington/config";
import Constants from "expo-constants";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import WebView, {
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";
import { tokens } from "@pokington/ui";
import {
  parseWebViewBridgeMessage,
  playWebViewHapticMessage,
} from "../lib/webViewHaptics";

const DEFAULT_WEB_ORIGIN = "http://localhost:3000";
const WEB_DEV_PORT = "3000";

function getExpoDevHost(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.linkingUri,
    Constants.debuggerHost,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const withoutProtocol = candidate.replace(/^[a-z]+:\/\//i, "");
    const host = withoutProtocol.split("/")[0]?.split(":")[0];
    if (host && host !== "localhost" && host !== "127.0.0.1") return host;
  }

  return null;
}

function normalizeOrigin(origin: string | null | undefined): string {
  const trimmed = origin?.trim().replace(/\/+$/, "");
  if (!trimmed) {
    const devHost = getExpoDevHost();
    return devHost ? `http://${devHost}:${WEB_DEV_PORT}` : DEFAULT_WEB_ORIGIN;
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function buildWebUrl(origin: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}

function getOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function WebShell({ path }: { path: string }) {
  const webOrigin = useMemo(() => normalizeOrigin(env.webOrigin), []);
  const sourceUri = useMemo(() => buildWebUrl(webOrigin, path), [path, webOrigin]);
  const allowedOrigin = useMemo(() => getOrigin(webOrigin), [webOrigin]);
  const [loadFailed, setLoadFailed] = useState(false);

  const handleShouldStartLoad = (request: WebViewNavigation) => {
    if (request.url === "about:blank") return true;

    const requestOrigin = getOrigin(request.url);
    if (!requestOrigin || requestOrigin === allowedOrigin) return true;

    void Linking.openURL(request.url).catch(() => {});
    return false;
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    const message = parseWebViewBridgeMessage(event.nativeEvent.data);
    if (!message) return;
    playWebViewHapticMessage(message);
  };

  if (loadFailed) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.title}>Pokington is unreachable</Text>
        <Text style={styles.body}>
          Start the web app or set EXPO_PUBLIC_WEB_ORIGIN to the deployed Pokington URL.
        </Text>
        <Text style={styles.url}>{sourceUri}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <WebView
        source={{ uri: sourceUri }}
        style={styles.webView}
        containerStyle={styles.webView}
        originWhitelist={["http://*", "https://*"]}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onMessage={handleMessage}
        onError={() => setLoadFailed(true)}
        onHttpError={(event) => {
          if (event.nativeEvent.statusCode >= 500) setLoadFailed(true);
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={tokens.colors.text} />
          </View>
        )}
        allowsBackForwardNavigationGestures
        contentInsetAdjustmentBehavior="never"
        domStorageEnabled
        javaScriptEnabled
        pullToRefreshEnabled={false}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        sharedCookiesEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  webView: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.background,
  },
  fallback: {
    flex: 1,
    justifyContent: "center",
    gap: tokens.spacing.md,
    backgroundColor: tokens.colors.background,
    paddingHorizontal: tokens.spacing.xl,
  },
  title: {
    color: tokens.colors.text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  body: {
    color: tokens.colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  url: {
    color: tokens.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
