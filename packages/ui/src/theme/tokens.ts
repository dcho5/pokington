export const tokens = {
  colors: {
    background: "#07111d",
    surface: "#102133",
    surfaceMuted: "rgba(255,255,255,0.08)",
    surfaceSubtle: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.1)",
    text: "#f8fafc",
    muted: "#94a3b8",
    accent: "#ef4444",
    accentStrong: "#b91c1c",
    danger: "#b91c1c",
    felt: "#1a5c2a",
    feltOverlay: "rgba(26,92,42,0.5)",
    cardFace: "#f8fafc",
    cardBack: "#0f172a",
    cardInk: "#111827",
    cardRed: "#dc2626",
    web: {
      felt: {
        DEFAULT: "#1a5c2a",
        dark: "#0f3d1a",
        light: "#2a7d3f",
      },
      wood: {
        DEFAULT: "#5c3a1e",
        dark: "#3d2513",
        light: "#7d5a3a",
      },
      gold: {
        DEFAULT: "#d4a847",
        light: "#e8c76a",
      },
      chip: {
        white: "#f0f0f0",
        red: "#d32f2f",
        blue: "#1976d2",
        green: "#388e3c",
        black: "#212121",
      },
      mobile: {
        surface: "#030712",
        card: "#0f1117",
      },
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radii: {
    sm: 8,
    md: 16,
    lg: 24,
    pill: 999,
  },
  typography: {
    label: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "800",
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "400",
    },
    title: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: "900",
    },
  },
} as const;

export type PokingtonTokens = typeof tokens;
